import { DAY_MS } from '../data/targets'

// Days are "YYYY-MM-DD" strings in UTC, which sort and compare as plain strings.
export const parseDay = (day: string) => Date.parse(`${day}T00:00:00Z`)
export const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (day: string, n: number) => toDay(parseDay(day) + n * DAY_MS)
const monthStart = (year: number, month: number) => toDay(Date.UTC(year, month - 1, 1))

export interface Preset {
  key: string
  label: string
  from: string | null
  to: string | null
}

// Presets count back from the latest date in the data, not from today, so they work on any export.
export function datePresets(anchor: string): Preset[] {
  const [y, m] = anchor.split('-').map(Number)
  const quarterStart = Math.floor((m - 1) / 3) * 3 + 1
  const lastN = (n: number): Preset => ({ key: `last${n}`, label: `Last ${n} days`, from: addDays(anchor, -(n - 1)), to: anchor })
  return [
    { key: 'all', label: 'All time', from: null, to: null },
    lastN(7),
    lastN(30),
    lastN(60),
    lastN(90),
    { key: 'month', label: 'This month', from: monthStart(y, m), to: anchor },
    { key: 'lastmonth', label: 'Last month', from: monthStart(y, m - 1), to: addDays(monthStart(y, m), -1) },
    { key: 'quarter', label: 'This quarter', from: monthStart(y, quarterStart), to: anchor },
  ]
}

const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function formatRange(from: string, to: string) {
  if (from === to) return longFmt.format(parseDay(from))
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${(sameYear ? shortFmt : longFmt).format(parseDay(from))} – ${longFmt.format(parseDay(to))}`
}

export function rangeLabel(from: string | null, to: string | null, anchor: string) {
  const preset = datePresets(anchor).find((p) => p.from === from && p.to === to)
  if (preset) return preset.label
  if (from && to) return formatRange(from, to)
  if (from) return `From ${longFmt.format(parseDay(from))}`
  return `Until ${longFmt.format(parseDay(to!))}`
}
