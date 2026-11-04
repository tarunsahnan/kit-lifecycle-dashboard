import { useEffect, type ReactNode } from 'react'
import { Badge } from '../components/ui'
import type { Kit, OrderRecord } from '../data/model'
import { ageing } from '../data/selectors'
import { STAGE_ENDING_AT, STEP_ORDER, stageDef, stepOf, type Step } from '../data/targets'
import type { EventType } from '../data/types'
import { countryName, fmtDateTime, fmtDays, productLabel } from '../lib/format'
import { statusOf } from './Orders'

const EVENT_LABELS: Record<EventType, string> = {
  kit_shipped: 'Kit shipped',
  kit_delivered: 'Kit delivered',
  sample_mailed: 'Sample mailed',
  sample_received: 'Sample received at lab',
  qc_passed: 'QC passed',
  qc_failed: 'QC failed',
  sequencing_complete: 'Sequencing complete',
  report_ready: 'Report ready',
  kit_replaced: 'Kit replaced',
}

const STEP_LABELS: Record<Step, string> = {
  kit_shipped: 'Kit shipped',
  kit_delivered: 'Kit delivered',
  sample_mailed: 'Sample mailed',
  sample_received: 'Sample received at lab',
  qc: 'QC result',
  sequencing_complete: 'Sequencing complete',
  report_ready: 'Report ready',
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  )
}

function KitTimeline({ record, kit }: { record: OrderRecord; kit: Kit }) {
  const items: ReactNode[] = []
  const shown = new Set<Step>()
  const live = kit.index === record.kits.length - 1

  for (const e of kit.events) {
    const step = stepOf(e.type)
    if (step) {
      // Show missed scans where they would have happened.
      for (const missing of kit.inferredSteps) {
        if (!shown.has(missing) && STEP_ORDER.indexOf(missing) < STEP_ORDER.indexOf(step)) {
          shown.add(missing)
          items.push(
            <li key={`missing-${missing}`} className="relative pl-6 text-slate-500">
              <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-dashed border-slate-400 bg-white" />
              <div className="text-sm italic">{STEP_LABELS[missing]}: no scan recorded</div>
              <div className="text-xs">A later event shows this step happened.</div>
            </li>,
          )
        }
      }
    }
    const stageKey = STAGE_ENDING_AT[e.type]
    const duration = stageKey ? record.durations.find((d) => d.kitIndex === kit.index && d.stage === stageKey) : undefined
    const target = stageKey ? stageDef(stageKey).targetDays : null
    const late = duration && target !== null && duration.days > target
    const dupes = kit.duplicates.filter((d) => d.type === e.type && d.at === e.at)
    const bad = e.type === 'qc_failed' || e.type === 'kit_replaced'
    items.push(
      <li key={e.eventId} className="relative pl-6">
        <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${bad ? 'bg-rose-500' : e.type === 'report_ready' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-slate-900">{EVENT_LABELS[e.type]}</span>
          {duration && (
            <span className={`text-xs tabular-nums ${late ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
              +{fmtDays(duration.days)} (target {target}d)
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {fmtDateTime(e.at)} · {e.source}
          {e.format !== 'utc' && <> · recorded as <code className="rounded bg-slate-100 px-1">{e.raw}</code></>}
        </div>
        {dupes.length > 0 && (
          <div className="text-xs text-amber-700">
            {dupes.length} duplicate {dupes.length === 1 ? 'row' : 'rows'} removed ({dupes.map((d) => d.eventId).join(', ')})
          </div>
        )}
      </li>,
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">Kit {kit.index + 1}</span>
        <span className="font-mono text-xs text-slate-500">{kit.kitId}</span>
        {live && record.kits.length > 1 && <Badge tone="indigo">current kit</Badge>}
        {kit.qcFailed && <Badge tone="rose">QC failed</Badge>}
        {kit.replaced && <Badge tone="amber">replaced</Badge>}
      </div>
      <ol className="flex flex-col gap-3 border-l border-slate-200 pl-1">{items}</ol>
    </div>
  )
}

export function OrderDetail({ record, orderId, asOf, onClose }: { record: OrderRecord | null; orderId: string; asOf: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const a = record ? ageing(record, asOf) : null

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Order details"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Order</p>
            <h2 className="font-mono text-xl font-semibold text-slate-900">{record?.order.orderId ?? orderId}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>

        {!record ? (
          <p className="text-sm text-slate-600">This order isn't in the loaded data.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Customer"><span className="font-mono">{record.order.customerId}</span></Fact>
              <Fact label="Product">{productLabel(record.order.product)}</Fact>
              <Fact label="Country">{countryName(record.order.country)}</Fact>
              <Fact label="Payment">{record.order.status}{record.order.isTest && <span className="ml-2"><Badge tone="amber">test order</Badge></span>}</Fact>
              <Fact label="Ordered">
                {fmtDateTime(record.order.createdAt)}
                <div className="text-xs text-slate-500">local: {record.order.createdAtRaw}</div>
              </Fact>
              <Fact label="Status">{statusOf(record)}</Fact>
            </dl>

            {a && (
              <div className={`rounded-lg p-3 text-sm ${a.stuck ? 'bg-rose-50 text-rose-900' : 'bg-slate-50 text-slate-700'}`}>
                <b>{a.stuck ? 'Stuck' : 'On track'}:</b> {fmtDays(a.daysInState)} in this stage (target {a.targetDays}d), waiting on{' '}
                {a.owner.toLowerCase()}.{record.stateNote && ` ${record.stateNote}.`}
              </div>
            )}
            {record.category === 'pipeline' && record.state === 'complete' && record.completedAt && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                Report ready {fmtDays((record.completedAt - record.order.createdAt) / 86_400_000)} after the order was placed.
              </div>
            )}
            {(record.category === 'cancelled' || record.category === 'refunded') && record.kits.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                This order was {record.category}, so its kit isn't expected to finish and isn't counted as stuck.
              </div>
            )}

            {record.kits.length ? (
              <div className="flex flex-col gap-3">
                {record.kits.map((k) => (
                  <KitTimeline key={k.kitId} record={record} kit={k} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                {record.category === 'no_kit' ? 'Upload-only order: no kit is shipped.' : 'No kit events recorded for this order.'}
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
