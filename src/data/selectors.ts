import type { OrderRecord } from './model'
import { summarize, type Summary } from './stats'
import {
  ACTIVE_STATES,
  DAY_MS,
  NO_KIT_PRODUCT,
  STAGES,
  activeStateDef,
  stageDef,
  type ActiveState,
  type Owner,
  type StageDef,
} from './targets'

export interface Filters {
  from: string | null
  to: string | null
  products: string[]
  countries: string[]
  includeTest: boolean
}

export const EMPTY_FILTERS: Filters = { from: null, to: null, products: [], countries: [], includeTest: false }

export function applyFilters(records: OrderRecord[], f: Filters): OrderRecord[] {
  return records.filter(
    (r) =>
      (f.includeTest || !r.order.isTest) &&
      (!f.from || r.createdDay >= f.from) &&
      (!f.to || r.createdDay <= f.to) &&
      (!f.products.length || f.products.includes(r.order.product)) &&
      (!f.countries.length || f.countries.includes(r.order.country)),
  )
}

export interface Ageing {
  state: ActiveState
  owner: Owner
  daysInState: number
  targetDays: number
  overdueDays: number
  stuck: boolean
}

export function ageing(r: OrderRecord, asOf: number): Ageing | null {
  if (r.category !== 'pipeline' || !r.state || r.state === 'complete' || r.stateSince === null) return null
  const def = activeStateDef(r.state)
  const targetDays = stageDef(def.stage).targetDays
  const daysInState = Math.max(0, (asOf - r.stateSince) / DAY_MS)
  return {
    state: r.state,
    owner: def.owner,
    daysInState,
    targetDays,
    overdueDays: daysInState - targetDays,
    stuck: daysInState > targetDays,
  }
}

export function overview(records: OrderRecord[], asOf: number) {
  const states = new Map(ACTIVE_STATES.map((s) => [s.key, { onTrack: 0, overdue: 0 }]))
  const endToEnd: number[] = []
  const counts = { pipeline: 0, active: 0, complete: 0, stuck: 0, no_kit: 0, cancelled: 0, refunded: 0, other: 0, replaced: 0 }
  for (const r of records) {
    counts[r.category]++
    if (r.category !== 'pipeline') continue
    if (r.kits.some((k) => k.replaced)) counts.replaced++
    if (r.state === 'complete') {
      counts.complete++
      if (r.completedAt) endToEnd.push((r.completedAt - r.order.createdAt) / DAY_MS)
      continue
    }
    const a = ageing(r, asOf)
    if (!a) continue
    counts.active++
    const bucket = states.get(a.state)!
    if (a.stuck) {
      counts.stuck++
      bucket.overdue++
    } else bucket.onTrack++
  }
  return {
    total: records.length,
    ...counts,
    endToEnd: summarize(endToEnd),
    states: ACTIVE_STATES.map((s) => ({ key: s.key, label: s.label, owner: s.owner, ...states.get(s.key)! })),
  }
}

export interface StuckRow extends Ageing {
  record: OrderRecord
}

export function stuckRows(records: OrderRecord[], asOf: number): StuckRow[] {
  const rows: StuckRow[] = []
  for (const r of records) {
    const a = ageing(r, asOf)
    if (a?.stuck) rows.push({ ...a, record: r })
  }
  return rows.sort((a, b) => b.overdueDays - a.overdueDays)
}

export const ALL = '*'

export interface TurnaroundRow {
  stage: StageDef
  byProduct: Record<string, Summary>
}

// Turnaround uses paid orders only; refunded and cancelled kits stop for business reasons.
export function turnaround(records: OrderRecord[], products: string[]): TurnaroundRow[] {
  const groups = new Map<string, number[]>()
  const add = (key: string, v: number) => {
    const list = groups.get(key)
    if (list) list.push(v)
    else groups.set(key, [v])
  }
  for (const r of records) {
    if (r.category !== 'pipeline') continue
    for (const d of r.durations) {
      add(`${d.stage}|${r.order.product}`, d.days)
      add(`${d.stage}|${ALL}`, d.days)
    }
  }
  return STAGES.map((stage) => ({
    stage,
    byProduct: Object.fromEntries(
      [ALL, ...products].map((p) => [p, summarize(groups.get(`${stage.key}|${p}`) ?? [], stage.targetDays)]),
    ),
  }))
}

export function endToEnd(records: OrderRecord[], products: string[]): Record<string, Summary> {
  const groups = new Map<string, number[]>([[ALL, []]])
  for (const r of records) {
    if (r.category !== 'pipeline' || !r.completedAt) continue
    const days = (r.completedAt - r.order.createdAt) / DAY_MS
    groups.get(ALL)!.push(days)
    const list = groups.get(r.order.product)
    if (list) list.push(days)
    else groups.set(r.order.product, [days])
  }
  return Object.fromEntries([ALL, ...products].map((p) => [p, summarize(groups.get(p) ?? [])]))
}

export function weeklyVolume(records: OrderRecord[], products: string[]) {
  const weeks = new Map<number, Record<string, number>>()
  for (const r of records) {
    const d = new Date(r.order.createdAt)
    const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    const row = weeks.get(monday) ?? Object.fromEntries(products.map((p) => [p, 0]))
    row[r.order.product] = (row[r.order.product] ?? 0) + 1
    weeks.set(monday, row)
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([week, row]) => ({ week, ...row }))
}

export const kitProducts = (products: string[]) => products.filter((p) => p !== NO_KIT_PRODUCT)
