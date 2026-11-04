import Papa from 'papaparse'
import { EVENT_TYPES, type EventType, type KitEvent, type Order, type RowError, type TimestampFormat } from './types'

export const ORDER_COLUMNS = ['order_id', 'created_at', 'customer_id', 'product', 'country', 'status', 'is_test']
export const EVENT_COLUMNS = ['event_id', 'order_id', 'kit_id', 'event_type', 'occurred_at', 'source']

export interface ParsedTimestamp {
  ms: number
  format: TimestampFormat
}

const ZONE = /(?:Z|[+-]\d{2}:\d{2})$/i

// Accepts ISO 8601 with Z or an offset, and "YYYY-MM-DD HH:MM:SS" with no zone, which is read as UTC.
export function parseTimestamp(value: string): ParsedTimestamp | null {
  let iso = value.trim().replace(' ', 'T')
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso += 'T00:00:00'
  iso = iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const hasZone = ZONE.test(iso)
  const ms = Date.parse(hasZone ? iso : `${iso}Z`)
  if (Number.isNaN(ms)) return null
  return { ms, format: /z$/i.test(iso) ? 'utc' : hasZone ? 'offset' : 'naive' }
}

export interface CsvResult<T> {
  rows: T[]
  rowCount: number
  missingColumns: string[]
  errors: RowError[]
}

function readCsv(text: string, required: string[]) {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  const fields = result.meta.fields ?? []
  return { data: result.data, missingColumns: required.filter((c) => !fields.includes(c)) }
}

const cell = (row: Record<string, string>, key: string) => (row[key] ?? '').trim()

export function parseOrders(text: string): CsvResult<Order> {
  const { data, missingColumns } = readCsv(text, ORDER_COLUMNS)
  const rows: Order[] = []
  const errors: RowError[] = []
  if (missingColumns.length) return { rows, rowCount: data.length, missingColumns, errors }

  data.forEach((row, i) => {
    const line = i + 2
    const orderId = cell(row, 'order_id')
    const ts = parseTimestamp(cell(row, 'created_at'))
    if (!orderId) return errors.push({ file: 'orders', line, message: 'Missing order_id' })
    if (!ts) return errors.push({ file: 'orders', line, message: `Unreadable created_at "${cell(row, 'created_at')}"` })
    rows.push({
      orderId,
      createdAt: ts.ms,
      createdAtRaw: cell(row, 'created_at'),
      customerId: cell(row, 'customer_id'),
      product: cell(row, 'product').toLowerCase(),
      country: cell(row, 'country').toUpperCase(),
      status: cell(row, 'status').toLowerCase(),
      isTest: ['true', '1', 'yes'].includes(cell(row, 'is_test').toLowerCase()),
      line,
    })
  })
  return { rows, rowCount: data.length, missingColumns, errors }
}

const KNOWN_TYPES = new Set<string>(EVENT_TYPES)

export function parseEvents(text: string): CsvResult<KitEvent> {
  const { data, missingColumns } = readCsv(text, EVENT_COLUMNS)
  const rows: KitEvent[] = []
  const errors: RowError[] = []
  if (missingColumns.length) return { rows, rowCount: data.length, missingColumns, errors }

  data.forEach((row, i) => {
    const line = i + 2
    const type = cell(row, 'event_type').toLowerCase()
    const raw = cell(row, 'occurred_at')
    const ts = parseTimestamp(raw)
    if (!cell(row, 'order_id') || !cell(row, 'kit_id'))
      return errors.push({ file: 'events', line, message: 'Missing order_id or kit_id' })
    if (!KNOWN_TYPES.has(type)) return errors.push({ file: 'events', line, message: `Unknown event_type "${type}"` })
    if (!ts) return errors.push({ file: 'events', line, message: `Unreadable occurred_at "${raw}"` })
    rows.push({
      eventId: cell(row, 'event_id'),
      orderId: cell(row, 'order_id'),
      kitId: cell(row, 'kit_id'),
      type: type as EventType,
      at: ts.ms,
      raw,
      format: ts.format,
      source: cell(row, 'source').toLowerCase(),
      line,
    })
  })
  return { rows, rowCount: data.length, missingColumns, errors }
}
