import type { EventType } from './types'

export const DAY_MS = 86_400_000

// Kitless product: the customer uploads existing data, so nothing ships.
export const NO_KIT_PRODUCT = 'upload_only'

export const STEP_ORDER = [
  'kit_shipped',
  'kit_delivered',
  'sample_mailed',
  'sample_received',
  'qc',
  'sequencing_complete',
  'report_ready',
] as const

export type Step = (typeof STEP_ORDER)[number]

export function stepOf(type: EventType): Step | null {
  if (type === 'qc_passed' || type === 'qc_failed') return 'qc'
  if (type === 'kit_replaced') return null
  return type
}

export type StageKey =
  | 'order_to_ship'
  | 'ship_to_deliver'
  | 'deliver_to_mail'
  | 'mail_to_receive'
  | 'receive_to_qc'
  | 'qc_to_sequenced'
  | 'sequenced_to_report'

export interface StageDef {
  key: StageKey
  label: string
  short: string
  targetDays: number
}

export const STAGES: StageDef[] = [
  { key: 'order_to_ship', label: 'Order placed → kit shipped', short: 'Ship kit', targetDays: 3 },
  { key: 'ship_to_deliver', label: 'Kit shipped → delivered', short: 'Deliver kit', targetDays: 7 },
  { key: 'deliver_to_mail', label: 'Delivered → sample mailed', short: 'Customer mails', targetDays: 45 },
  { key: 'mail_to_receive', label: 'Sample mailed → received at lab', short: 'Sample to lab', targetDays: 14 },
  { key: 'receive_to_qc', label: 'Received → QC result', short: 'QC', targetDays: 7 },
  { key: 'qc_to_sequenced', label: 'QC passed → sequencing complete', short: 'Sequencing', targetDays: 28 },
  { key: 'sequenced_to_report', label: 'Sequencing complete → report ready', short: 'Report', targetDays: 5 },
]

// The stage that ends with each event, used to label gaps in an order timeline.
export const STAGE_ENDING_AT: Partial<Record<EventType, StageKey>> = {
  kit_shipped: 'order_to_ship',
  kit_delivered: 'ship_to_deliver',
  sample_mailed: 'deliver_to_mail',
  sample_received: 'mail_to_receive',
  qc_passed: 'receive_to_qc',
  qc_failed: 'receive_to_qc',
  sequencing_complete: 'qc_to_sequenced',
  report_ready: 'sequenced_to_report',
}

export type ActiveState =
  | 'awaiting_shipment'
  | 'in_transit'
  | 'with_customer'
  | 'sample_in_transit'
  | 'in_qc'
  | 'sequencing'
  | 'report_pending'

export type PipelineState = ActiveState | 'complete'

export type Owner = 'Fulfillment' | 'Carrier' | 'Customer' | 'Lab'

export interface ActiveStateDef {
  key: ActiveState
  label: string
  stage: StageKey
  owner: Owner
}

export const ACTIVE_STATES: ActiveStateDef[] = [
  { key: 'awaiting_shipment', label: 'Awaiting shipment', stage: 'order_to_ship', owner: 'Fulfillment' },
  { key: 'in_transit', label: 'Kit in transit', stage: 'ship_to_deliver', owner: 'Carrier' },
  { key: 'with_customer', label: 'With customer', stage: 'deliver_to_mail', owner: 'Customer' },
  { key: 'sample_in_transit', label: 'Sample in transit', stage: 'mail_to_receive', owner: 'Carrier' },
  { key: 'in_qc', label: 'At lab: QC', stage: 'receive_to_qc', owner: 'Lab' },
  { key: 'sequencing', label: 'Sequencing', stage: 'qc_to_sequenced', owner: 'Lab' },
  { key: 'report_pending', label: 'Report pending', stage: 'sequenced_to_report', owner: 'Lab' },
]

export const OWNERS: Owner[] = ['Fulfillment', 'Carrier', 'Customer', 'Lab']

export function stageDef(key: StageKey): StageDef {
  return STAGES.find((s) => s.key === key)!
}

export function activeStateDef(key: ActiveState): ActiveStateDef {
  return ACTIVE_STATES.find((s) => s.key === key)!
}

export function stateLabel(state: PipelineState): string {
  return state === 'complete' ? 'Report ready' : activeStateDef(state).label
}
