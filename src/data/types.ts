export const EVENT_TYPES = [
  'kit_shipped',
  'kit_delivered',
  'sample_mailed',
  'sample_received',
  'qc_passed',
  'qc_failed',
  'sequencing_complete',
  'report_ready',
  'kit_replaced',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export type TimestampFormat = 'utc' | 'offset' | 'naive'

export interface Order {
  orderId: string
  createdAt: number
  createdAtRaw: string
  customerId: string
  product: string
  country: string
  status: string
  isTest: boolean
  line: number
}

export interface KitEvent {
  eventId: string
  orderId: string
  kitId: string
  type: EventType
  at: number
  raw: string
  format: TimestampFormat
  source: string
  line: number
}

export interface RowError {
  file: 'orders' | 'events'
  line: number
  message: string
}
