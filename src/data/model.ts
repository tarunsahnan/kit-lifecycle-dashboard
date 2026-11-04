import { cleanEvents, dedupeOrders } from './clean'
import { parseEvents, parseOrders } from './parse'
import {
  DAY_MS,
  NO_KIT_PRODUCT,
  STEP_ORDER,
  stepOf,
  type PipelineState,
  type StageKey,
  type Step,
} from './targets'
import type { KitEvent, Order, RowError, TimestampFormat } from './types'

export type Category = 'pipeline' | 'no_kit' | 'cancelled' | 'refunded' | 'other'

export interface Kit {
  kitId: string
  index: number
  events: KitEvent[]
  duplicates: KitEvent[]
  steps: Partial<Record<Step, KitEvent>>
  qcFailed: KitEvent | null
  replaced: KitEvent | null
  // Steps with no event even though a later step happened (a missed scan).
  inferredSteps: Step[]
  highest: number
}

export interface StageDuration {
  stage: StageKey
  kitIndex: number
  days: number
}

export interface OrderRecord {
  order: Order
  createdDay: string
  category: Category
  kits: Kit[]
  // Only set for paid kit orders; cancelled/refunded orders are frozen, not "in progress".
  state: PipelineState | null
  stateSince: number | null
  stateNote: string
  completedAt: number | null
  durations: StageDuration[]
}

export interface QualityRule {
  label: string
  count: number
  handling: string
}

export interface Dataset {
  label: string
  orders: OrderRecord[]
  byOrderId: Map<string, OrderRecord>
  byKitId: Map<string, OrderRecord>
  asOf: number
  firstDay: string
  lastDay: string
  products: string[]
  countries: string[]
  rules: QualityRule[]
  rowErrors: RowError[]
  rowErrorCount: number
  orphans: KitEvent[]
}

export type LoadResult = { ok: true; dataset: Dataset } | { ok: false; errors: string[] }

const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function categorize(o: Order): Category {
  if (o.product === NO_KIT_PRODUCT) return 'no_kit'
  if (o.status === 'cancelled') return 'cancelled'
  if (o.status === 'refunded') return 'refunded'
  if (o.status === 'paid') return 'pipeline'
  return 'other'
}

function buildKit(kitId: string, events: KitEvent[], duplicates: KitEvent[]): Kit {
  events.sort((a, b) => a.at - b.at)
  const steps: Partial<Record<Step, KitEvent>> = {}
  let highest = -1
  for (const e of events) {
    const step = stepOf(e.type)
    if (!step) continue
    steps[step] ??= e
    highest = Math.max(highest, STEP_ORDER.indexOf(step))
  }
  return {
    kitId,
    index: 0,
    events,
    duplicates,
    steps,
    qcFailed: events.find((e) => e.type === 'qc_failed') ?? null,
    replaced: events.find((e) => e.type === 'kit_replaced') ?? null,
    inferredSteps: STEP_ORDER.slice(0, Math.max(highest, 0)).filter((s) => !steps[s]),
    highest,
  }
}

function stageDurations(order: Order, kits: Kit[]) {
  const durations: StageDuration[] = []
  let negative = 0
  kits.forEach((kit, i) => {
    const at = (s: Step) => kit.steps[s]?.at ?? null
    // A replacement kit's shipping clock starts when the previous kit was replaced (or failed QC).
    const prev = kits[i - 1]
    const start = i === 0 ? order.createdAt : (prev.replaced?.at ?? prev.qcFailed?.at ?? null)
    const qc = kit.steps.qc
    const pairs: [StageKey, number | null, number | null][] = [
      ['order_to_ship', start, at('kit_shipped')],
      ['ship_to_deliver', at('kit_shipped'), at('kit_delivered')],
      ['deliver_to_mail', at('kit_delivered'), at('sample_mailed')],
      ['mail_to_receive', at('sample_mailed'), at('sample_received')],
      ['receive_to_qc', at('sample_received'), qc?.at ?? null],
      ['qc_to_sequenced', qc?.type === 'qc_passed' ? qc.at : null, at('sequencing_complete')],
      ['sequenced_to_report', at('sequencing_complete'), at('report_ready')],
    ]
    for (const [stage, from, to] of pairs) {
      if (from === null || to === null) continue
      if (to < from) negative++
      else durations.push({ stage, kitIndex: i, days: (to - from) / DAY_MS })
    }
  })
  return { durations, negative }
}

const STATE_FOR_STEP: Record<Step, PipelineState> = {
  kit_shipped: 'in_transit',
  kit_delivered: 'with_customer',
  sample_mailed: 'sample_in_transit',
  sample_received: 'in_qc',
  qc: 'sequencing',
  sequencing_complete: 'report_pending',
  report_ready: 'complete',
}

function currentState(order: Order, kits: Kit[]): { state: PipelineState; since: number; note: string } {
  const live = kits.at(-1)
  if (!live) return { state: 'awaiting_shipment', since: order.createdAt, note: 'No kit shipped yet' }
  if (live.replaced)
    return { state: 'awaiting_shipment', since: live.replaced.at, note: 'Kit replaced, new kit not shipped yet' }
  if (live.qcFailed)
    return { state: 'awaiting_shipment', since: live.qcFailed.at, note: 'QC failed, no replacement kit yet' }
  if (live.highest < 0) return { state: 'awaiting_shipment', since: order.createdAt, note: 'No kit shipped yet' }
  const step = STEP_ORDER[live.highest]
  const missing = live.inferredSteps.length ? `Missing scan: ${live.inferredSteps.join(', ')}` : ''
  return { state: STATE_FOR_STEP[step], since: live.steps[step]!.at, note: missing }
}

function sortByCount(values: string[]) {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
}

export function loadDataset(ordersText: string, eventsText: string, label: string): LoadResult {
  const ordersCsv = parseOrders(ordersText)
  const eventsCsv = parseEvents(eventsText)
  const errors: string[] = []
  if (ordersCsv.missingColumns.length)
    errors.push(`Orders file is missing columns: ${ordersCsv.missingColumns.join(', ')}`)
  if (eventsCsv.missingColumns.length)
    errors.push(`Events file is missing columns: ${eventsCsv.missingColumns.join(', ')}`)
  if (!errors.length && !ordersCsv.rows.length) errors.push('Orders file has no readable rows')
  if (errors.length) return { ok: false, errors }

  const { orders, duplicates: duplicateOrders } = dedupeOrders(ordersCsv.rows)
  const orderIds = new Set(orders.map((o) => o.orderId))
  const clean = cleanEvents(eventsCsv.rows, orderIds)

  const formats: Record<TimestampFormat, number> = { utc: 0, offset: 0, naive: 0 }
  for (const e of eventsCsv.rows) formats[e.format]++

  const eventsByOrder = new Map<string, Map<string, KitEvent[]>>()
  for (const e of clean.events) {
    const kits = eventsByOrder.get(e.orderId) ?? new Map<string, KitEvent[]>()
    eventsByOrder.set(e.orderId, kits)
    kits.set(e.kitId, [...(kits.get(e.kitId) ?? []), e])
  }
  const dupesByKit = new Map<string, KitEvent[]>()
  for (const e of clean.duplicates) {
    const key = `${e.orderId}|${e.kitId}`
    dupesByKit.set(key, [...(dupesByKit.get(key) ?? []), e])
  }

  let negativeDurations = 0
  let asOf = 0
  const inferred = new Map<Step, number>()
  const records: OrderRecord[] = orders.map((order) => {
    asOf = Math.max(asOf, order.createdAt)
    const kitEvents = eventsByOrder.get(order.orderId) ?? new Map()
    const kits = [...kitEvents.entries()]
      .map(([kitId, evs]) => buildKit(kitId, evs, dupesByKit.get(`${order.orderId}|${kitId}`) ?? []))
      .sort((a, b) => a.events[0].at - b.events[0].at)
    kits.forEach((k, i) => {
      k.index = i
      asOf = Math.max(asOf, k.events.at(-1)!.at)
      for (const s of k.inferredSteps) inferred.set(s, (inferred.get(s) ?? 0) + 1)
    })
    const { durations, negative } = stageDurations(order, kits)
    negativeDurations += negative
    const category = categorize(order)
    const current = category === 'pipeline' ? currentState(order, kits) : null
    return {
      order,
      createdDay: toDay(order.createdAt),
      category,
      kits,
      state: current?.state ?? null,
      stateSince: current?.since ?? null,
      stateNote: current?.note ?? '',
      completedAt: kits.at(-1)?.steps.report_ready?.at ?? null,
      durations,
    }
  })

  const byOrderId = new Map(records.map((r) => [r.order.orderId, r]))
  const byKitId = new Map<string, OrderRecord>()
  for (const r of records) for (const k of r.kits) byKitId.set(k.kitId, r)

  const count = (pred: (r: OrderRecord) => boolean) => records.filter(pred).length
  const rowErrors = [...ordersCsv.errors, ...eventsCsv.errors]
  const rules: QualityRule[] = [
    {
      label: 'Unreadable rows',
      count: rowErrors.length,
      handling: 'Skipped. Each one is listed below with its line number.',
    },
    { label: 'Duplicate order_id', count: duplicateOrders.length, handling: 'Kept the first row.' },
    {
      label: 'Events for unknown orders (orphans)',
      count: clean.orphans.length,
      handling: 'Dropped: the order_id is not in orders.csv.',
    },
    {
      label: 'Duplicate events',
      count: clean.duplicates.length,
      handling: `Same kit, event type and instant counted once. ${clean.reformattedDuplicates} of them wrote the same instant in a different format.`,
    },
    {
      label: 'Timestamps with a UTC offset',
      count: formats.offset,
      handling: 'Converted to UTC. All dates in the app are UTC.',
    },
    {
      label: 'Timestamps with no time zone',
      count: formats.naive,
      handling: 'Assumed to be UTC, like most rows in the file.',
    },
    {
      label: 'Missing scans',
      count: [...inferred.values()].reduce((a, b) => a + b, 0),
      handling: `A later event proves the step happened, so it is not treated as stuck, and that stage gets no duration. ${[...inferred.entries()].map(([s, n]) => `${s}: ${n}`).join(', ') || 'None'}.`,
    },
    {
      label: 'Test orders',
      count: count((r) => r.order.isTest),
      handling: 'Hidden by default. Use "Include test orders" to show them.',
    },
    {
      label: 'Upload-only orders',
      count: count((r) => r.category === 'no_kit'),
      handling: `No kit ships, so they count toward order volume only.${
        count((r) => r.category === 'no_kit' && r.kits.length > 0)
          ? ` ${count((r) => r.category === 'no_kit' && r.kits.length > 0)} have kit events anyway; those show in the order history only.`
          : ''
      }`,
    },
    {
      label: 'Cancelled orders with kit events',
      count: count((r) => r.category === 'cancelled' && r.kits.length > 0),
      handling: 'Shown as cancelled. Never counted as in progress or stuck.',
    },
    {
      label: 'Refunded orders',
      count: count((r) => r.category === 'refunded'),
      handling: 'The pipeline stops on purpose, so they are never counted as stuck. Excluded from turnaround times.',
    },
    {
      label: 'Orders with a replacement kit',
      count: count((r) => r.kits.some((k) => k.replaced)),
      handling: 'The newest kit is the live one. Earlier kits stay in the order history.',
    },
    {
      label: 'Paid kit orders with no events',
      count: count((r) => r.category === 'pipeline' && r.kits.length === 0),
      handling: 'Counted as awaiting shipment from the order date.',
    },
    {
      label: 'Negative stage durations',
      count: negativeDurations,
      handling: 'Skipped from turnaround stats.',
    },
  ]

  const days = records.map((r) => r.createdDay).sort()
  return {
    ok: true,
    dataset: {
      label,
      orders: records,
      byOrderId,
      byKitId,
      asOf,
      firstDay: days[0],
      lastDay: days.at(-1)!,
      products: sortByCount(records.map((r) => r.order.product)),
      countries: sortByCount(records.map((r) => r.order.country)),
      rules,
      rowErrors: rowErrors.slice(0, 200),
      rowErrorCount: rowErrors.length,
      orphans: clean.orphans,
    },
  }
}
