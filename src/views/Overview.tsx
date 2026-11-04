import { useMemo, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID, TICK, legendProps, tooltipProps } from '../lib/chart'
import { Card } from '../components/ui'
import type { OrderRecord } from '../data/model'
import { overview, weeklyVolume } from '../data/selectors'
import { fmtInt, fmtPct, fmtShort, productColor, productLabel } from '../lib/format'

function Stat({ label, value, sub, children }: { label: string; value: string; sub: string; children?: ReactNode }) {
  return (
    <div className="bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
      {children}
    </div>
  )
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600">
      {label}
      <b className="font-semibold tabular-nums text-slate-800">{fmtInt(value)}</b>
    </span>
  )
}

export function Overview({ records, products, asOf, onOpenStuck }: {
  records: OrderRecord[]
  products: string[]
  asOf: number
  onOpenStuck: () => void
}) {
  const s = useMemo(() => overview(records, asOf), [records, asOf])
  // Only stack products that survive the filters, so the legend doesn't list empty series.
  const shownProducts = useMemo(() => products.filter((p) => records.some((r) => r.order.product === p)), [records, products])
  const weeks = useMemo(() => weeklyVolume(records, shownProducts), [records, shownProducts])
  const completeShare = s.pipeline ? s.complete / s.pipeline : null
  const stateData = s.states.map((st) => ({
    name: st.label,
    'On track': st.onTrack,
    'Over target': st.overdue,
    total: st.onTrack + st.overdue,
  }))

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Orders" value={fmtInt(s.total)} sub={`${fmtInt(s.pipeline)} paid kit orders`} />
          <Stat label="In progress" value={fmtInt(s.active)} sub="Paid kit orders not finished" />
          <Stat label="Report ready" value={fmtInt(s.complete)} sub={`${fmtPct(completeShare)} of paid kit orders`}>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(completeShare ?? 0) * 100}%` }} />
            </div>
          </Stat>
          <button
            type="button"
            onClick={onOpenStuck}
            className="group flex flex-col justify-start bg-white p-4 text-left outline-none transition hover:bg-rose-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Stuck</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${s.stuck ? 'text-rose-600' : 'text-slate-900'}`}>{fmtInt(s.stuck)}</div>
            <div className="mt-0.5 text-xs font-medium text-indigo-600 group-hover:underline">View list →</div>
          </button>
          <Stat
            label="Order → report"
            value={s.endToEnd.median === null ? '–' : `${Math.round(s.endToEnd.median)} days`}
            sub={s.endToEnd.p90 === null ? 'No finished orders' : `Median · 90% within ${Math.round(s.endToEnd.p90)} days`}
          />
          <Stat label="Replacement kits" value={fmtInt(s.replaced)} sub="Orders that needed a new kit" />
        </div>
        {s.no_kit + s.cancelled + s.refunded + s.other > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-500">Not in the kit pipeline</span>
            {s.no_kit > 0 && <CountPill label="Upload only" value={s.no_kit} />}
            {s.cancelled > 0 && <CountPill label="Cancelled" value={s.cancelled} />}
            {s.refunded > 0 && <CountPill label="Refunded" value={s.refunded} />}
            {s.other > 0 && <CountPill label="Other status" value={s.other} />}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Where kits are now" subtitle="Paid kit orders in progress, by current stage">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateData} layout="vertical" margin={{ left: 4, right: 4 }} barCategoryGap="22%">
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={128} tick={TICK} axisLine={false} tickLine={false} />
                {/* Totals as a right-hand axis so every row shows one, even with no overdue segment. */}
                <YAxis
                  yAxisId="total"
                  orientation="right"
                  type="category"
                  dataKey="total"
                  width={44}
                  tick={{ ...TICK, fill: '#334155', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...tooltipProps} />
                <Legend {...legendProps} />
                <Bar dataKey="On track" stackId="a" fill="#6366f1" isAnimationActive={false} />
                <Bar dataKey="Over target" stackId="a" fill="#f43f5e" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Orders per week" subtitle="By order date (UTC), week starting Monday">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ right: 8 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="week" tickFormatter={(v: number) => fmtShort(v)} tick={TICK} minTickGap={16} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={TICK} width={36} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipProps} labelFormatter={(v) => `Week of ${fmtShort(Number(v))}`} />
                <Legend {...legendProps} />
                {shownProducts.map((p, i) => (
                  <Bar
                    key={p}
                    dataKey={p}
                    name={productLabel(p)}
                    stackId="v"
                    fill={productColor(p, products)}
                    radius={i === shownProducts.length - 1 ? [3, 3, 0, 0] : undefined}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
