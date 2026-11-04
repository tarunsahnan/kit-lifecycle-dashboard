import { useMemo, useState } from 'react'
import { Badge, Card, Empty } from '../components/ui'
import type { OrderRecord } from '../data/model'
import { ageing } from '../data/selectors'
import { stateLabel } from '../data/targets'
import { countryName, fmtDate, productLabel } from '../lib/format'

const LIMIT = 100

export function statusOf(r: OrderRecord): string {
  if (r.category === 'pipeline' && r.state) return stateLabel(r.state)
  if (r.category === 'no_kit') return 'Upload only'
  if (r.category === 'cancelled') return 'Cancelled'
  if (r.category === 'refunded') return 'Refunded'
  return r.order.status || 'Unknown'
}

export function Orders({ records, asOf, onOpenOrder }: {
  records: OrderRecord[]
  asOf: number
  onOpenOrder: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? records.filter(
          (r) =>
            r.order.orderId.toLowerCase().includes(q) ||
            r.order.customerId.toLowerCase().includes(q) ||
            r.kits.some((k) => k.kitId.toLowerCase().includes(q)),
        )
      : records
    return [...list].sort((a, b) => b.order.createdAt - a.order.createdAt)
  }, [records, query])

  return (
    <Card title="Find an order" subtitle="Search by order, kit or customer ID. Click a row to see its full history.">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ord_…, kit_… or cus_…"
        className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
        aria-label="Search orders"
      />
      {!matches.length ? (
        <Empty>No orders match.</Empty>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Ordered</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Kits</th>
              </tr>
            </thead>
            <tbody>
              {matches.slice(0, LIMIT).map((r) => {
                const stuck = ageing(r, asOf)?.stuck
                return (
                  <tr
                    key={r.order.orderId}
                    className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/50"
                    onClick={() => onOpenOrder(r.order.orderId)}
                  >
                    <td className="px-3 py-2 font-mono text-indigo-700">
                      {r.order.orderId}
                      {r.order.isTest && <span className="ml-2"><Badge tone="amber">test</Badge></span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fmtDate(r.order.createdAt)}</td>
                    <td className="px-3 py-2">{productLabel(r.order.product)}</td>
                    <td className="px-3 py-2">{countryName(r.order.country)}</td>
                    <td className="px-3 py-2">
                      <span className="mr-2">{statusOf(r)}</span>
                      {stuck && <Badge tone="rose">stuck</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.kits.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {matches.length > LIMIT && (
            <p className="mt-3 text-sm text-slate-500">
              Showing the newest {LIMIT} of {matches.length.toLocaleString('en-US')}. Search to narrow down.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
