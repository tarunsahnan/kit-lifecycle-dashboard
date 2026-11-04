import { useMemo, useState } from 'react'
import { Badge, Card, Chip, Empty } from '../components/ui'
import type { OrderRecord } from '../data/model'
import { stuckRows } from '../data/selectors'
import { ACTIVE_STATES, OWNERS, activeStateDef, type ActiveState, type Owner } from '../data/targets'
import { countryName, downloadCsv, fmtDate, fmtDays, productLabel } from '../lib/format'

const PAGE = 100

export function Stuck({ records, asOf, onOpenOrder }: {
  records: OrderRecord[]
  asOf: number
  onOpenOrder: (id: string) => void
}) {
  const all = useMemo(() => stuckRows(records, asOf), [records, asOf])
  const [state, setState] = useState<ActiveState | null>(null)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const rows = all.filter((r) => (!state || r.state === state) && (!owner || r.owner === owner))
  const countBy = (pred: (r: (typeof all)[number]) => boolean) => all.filter(pred).length

  const exportCsv = () =>
    downloadCsv('stuck-kits.csv', [
      ['order_id', 'kit_id', 'customer_id', 'product', 'country', 'stage', 'waiting_on', 'since_utc', 'days_in_stage', 'target_days', 'days_over', 'note'],
      ...rows.map((r) => [
        r.record.order.orderId,
        r.record.kits.at(-1)?.kitId ?? '',
        r.record.order.customerId,
        r.record.order.product,
        r.record.order.country,
        activeStateDef(r.state).label,
        r.owner,
        new Date(r.record.stateSince!).toISOString(),
        r.daysInState.toFixed(1),
        r.targetDays,
        r.overdueDays.toFixed(1),
        r.record.stateNote,
      ]),
    ])

  return (
    <Card
      title={`${all.length.toLocaleString('en-US')} kits need follow-up`}
      subtitle="Paid orders that have spent longer in their current stage than the target. Sorted by days over target."
      actions={
        <button
          type="button"
          onClick={exportCsv}
          disabled={!rows.length}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      }
    >
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-medium uppercase tracking-wide text-slate-500">Waiting on</span>
          <Chip active={!owner} onClick={() => setOwner(null)}>All</Chip>
          {OWNERS.map((o) => (
            <Chip key={o} active={owner === o} onClick={() => setOwner(owner === o ? null : o)}>
              {o} ({countBy((r) => r.owner === o)})
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-medium uppercase tracking-wide text-slate-500">Stage</span>
          <Chip active={!state} onClick={() => setState(null)}>All</Chip>
          {ACTIVE_STATES.map((s) => {
            const n = countBy((r) => r.state === s.key)
            return n ? (
              <Chip key={s.key} active={state === s.key} onClick={() => setState(state === s.key ? null : s.key)}>
                {s.label} ({n})
              </Chip>
            ) : null
          })}
        </div>
      </div>

      {!rows.length ? (
        <Empty>Nothing stuck for these filters.</Empty>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[47.5rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Waiting on</th>
                <th className="px-3 py-2 font-medium">Since</th>
                <th className="px-3 py-2 text-right font-medium">In stage</th>
                <th className="px-3 py-2 text-right font-medium">Over by</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r) => (
                <tr
                  key={r.record.order.orderId}
                  className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/50"
                  onClick={() => onOpenOrder(r.record.order.orderId)}
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-indigo-700">{r.record.order.orderId}</span>
                    {r.record.stateNote && <div className="text-xs text-slate-500">{r.record.stateNote}</div>}
                  </td>
                  <td className="px-3 py-2">{productLabel(r.record.order.product)}</td>
                  <td className="px-3 py-2">{countryName(r.record.order.country)}</td>
                  <td className="px-3 py-2">{activeStateDef(r.state).label}</td>
                  <td className="px-3 py-2"><Badge>{r.owner}</Badge></td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fmtDate(r.record.stateSince!)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDays(r.daysInState)} <span className="text-slate-400">/ {r.targetDays}d</span></td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-rose-700">+{fmtDays(r.overdueDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <button type="button" className="mt-3 text-sm font-medium text-indigo-600 hover:underline" onClick={() => setLimit(limit + PAGE)}>
              Show more ({rows.length - limit} left)
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
