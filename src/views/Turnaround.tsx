import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Empty } from '../components/ui'
import { GRID, TICK, legendProps, tooltipProps } from '../lib/chart'
import type { OrderRecord } from '../data/model'
import { ALL, endToEnd, kitProducts, turnaround } from '../data/selectors'
import type { Summary } from '../data/stats'
import { fmtDays, fmtInt, fmtPct, productColor, productLabel } from '../lib/format'

function pctTone(p: number | null) {
  if (p === null) return 'text-slate-400'
  if (p >= 0.95) return 'text-emerald-700 bg-emerald-50'
  if (p >= 0.85) return 'text-amber-800 bg-amber-50'
  return 'text-rose-700 bg-rose-50'
}

function Cell({ s, target }: { s: Summary; target?: number }) {
  if (!s.n) return <td className="px-3 py-2 text-slate-400">–</td>
  const slow = target !== undefined && s.median !== null && s.median > target
  return (
    <td className="px-3 py-2 align-top">
      <div className={`font-medium tabular-nums ${slow ? 'text-rose-700' : 'text-slate-900'}`}>{fmtDays(s.median)}</div>
      <div className="text-xs text-slate-500 tabular-nums">p90 {fmtDays(s.p90)} · n {fmtInt(s.n)}</div>
      {s.withinTarget !== null && (
        <div className={`mt-1 inline-block rounded px-1.5 text-xs font-medium tabular-nums ${pctTone(s.withinTarget)}`}>
          {fmtPct(s.withinTarget)} on time
        </div>
      )}
    </td>
  )
}

export function Turnaround({ records, products }: { records: OrderRecord[]; products: string[] }) {
  const kitProds = useMemo(() => kitProducts(products), [products])
  const rows = useMemo(() => turnaround(records, kitProds), [records, kitProds])
  const e2e = useMemo(() => endToEnd(records, kitProds), [records, kitProds])
  const chart = rows.map((r) => ({
    name: r.stage.short,
    ...Object.fromEntries(
      kitProds.map((p) => {
        const within = r.byProduct[p].withinTarget
        return [p, within === null ? null : Math.round((1 - within) * 1000) / 10]
      }),
    ),
  }))

  if (!rows.some((r) => r.byProduct[ALL].n)) return <Empty>No completed stages for these filters.</Empty>

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Time per stage"
        subtitle="Median days with 90th percentile, and the share finished within target. Paid orders only, replacement kits included. All times in calendar days."
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">All kits</th>
                {kitProds.map((p) => (
                  <th key={p} className="px-3 py-2 font-medium">{productLabel(p)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stage.key} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 align-top font-medium text-slate-800">{r.stage.label}</td>
                  <td className="px-3 py-2 align-top tabular-nums text-slate-600">{r.stage.targetDays}d</td>
                  <Cell s={r.byProduct[ALL]} target={r.stage.targetDays} />
                  {kitProds.map((p) => (
                    <Cell key={p} s={r.byProduct[p]} target={r.stage.targetDays} />
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-3 py-2 align-top font-semibold text-slate-800">Order placed → report ready</td>
                <td className="px-3 py-2 align-top text-slate-400">–</td>
                <Cell s={e2e[ALL]} />
                {kitProds.map((p) => (
                  <Cell key={p} s={e2e[p]} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Where kits run late" subtitle="Share of kits that took longer than the target at each stage, by product. The dashed line marks 10%.">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ right: 8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="name" tick={TICK} interval={0} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={TICK} width={44} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipProps} formatter={(v) => `${v}% late`} />
              <Legend {...legendProps} />
              <ReferenceLine y={10} stroke="#94a3b8" strokeDasharray="4 4" />
              {kitProds.map((p) => (
                <Bar
                  key={p}
                  dataKey={p}
                  name={productLabel(p)}
                  fill={productColor(p, products)}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
