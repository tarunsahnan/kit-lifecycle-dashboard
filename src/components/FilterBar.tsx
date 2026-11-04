import { useMemo, type ReactNode } from 'react'
import type { Dataset } from '../data/model'
import { EMPTY_FILTERS, type Filters } from '../data/selectors'
import { countryName, productLabel } from '../lib/format'
import { DateRangePicker } from './DateRangePicker'
import { FilterIcon, TriggerButton, usePopover } from './Popover'

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function Option({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
      <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={checked} onChange={onChange} />
      <span className="flex-1">{label}</span>
      <span className="text-xs tabular-nums text-slate-400">{count.toLocaleString('en-US')}</span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-2 py-2 last:border-0">
      <div className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  )
}

function FiltersMenu({ dataset, filters, onChange }: { dataset: Dataset; filters: Filters; onChange: (f: Filters) => void }) {
  const { open, setOpen, ref } = usePopover()
  const counts = useMemo(() => {
    const products = new Map<string, number>()
    const countries = new Map<string, number>()
    for (const r of dataset.orders) {
      products.set(r.order.product, (products.get(r.order.product) ?? 0) + 1)
      countries.set(r.order.country, (countries.get(r.order.country) ?? 0) + 1)
    }
    return { products, countries }
  }, [dataset])
  const active = filters.products.length + filters.countries.length + (filters.includeTest ? 1 : 0)
  const summary = [
    filters.products.length === 1 ? productLabel(filters.products[0]) : filters.products.length > 1 ? `${filters.products.length} products` : '',
    filters.countries.length === 1 ? countryName(filters.countries[0]) : filters.countries.length > 1 ? `${filters.countries.length} countries` : '',
    filters.includeTest ? 'Test orders' : '',
  ].filter(Boolean)

  return (
    <div className="sm:relative" ref={ref}>
      <TriggerButton active={active > 0} open={open} onClick={() => setOpen(!open)} icon={FilterIcon}>
        <span className="max-w-[14rem] truncate">{summary.length ? summary.join(' · ') : 'Filters'}</span>
      </TriggerButton>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-2 sm:left-auto sm:right-0 sm:w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-[60vh] overflow-y-auto">
            <Section title="Product">
              {dataset.products.map((p) => (
                <Option
                  key={p}
                  label={productLabel(p)}
                  count={counts.products.get(p) ?? 0}
                  checked={filters.products.includes(p)}
                  onChange={() => onChange({ ...filters, products: toggle(filters.products, p) })}
                />
              ))}
            </Section>
            <Section title="Country">
              {dataset.countries.map((c) => (
                <Option
                  key={c}
                  label={countryName(c)}
                  count={counts.countries.get(c) ?? 0}
                  checked={filters.countries.includes(c)}
                  onChange={() => onChange({ ...filters, countries: toggle(filters.countries, c) })}
                />
              ))}
            </Section>
            <Section title="Other">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={filters.includeTest}
                  onChange={(e) => onChange({ ...filters, includeTest: e.target.checked })}
                />
                Include internal test orders
              </label>
            </Section>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5">
            <button
              type="button"
              disabled={!active}
              onClick={() => onChange({ ...filters, products: [], countries: [], includeTest: false })}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
            >
              Reset
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function FilterBar({ dataset, filters, onChange, maxDay, disabled }: {
  dataset: Dataset
  filters: Filters
  onChange: (f: Filters) => void
  maxDay: string
  disabled: boolean
}) {
  const active =
    filters.from || filters.to || filters.products.length || filters.countries.length || filters.includeTest
  if (disabled)
    return (
      <div className="flex h-9 items-center text-sm text-slate-400">
        Filters don't apply here: this tab covers every row in the loaded files.
      </div>
    )
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          from={filters.from}
          to={filters.to}
          minDay={dataset.firstDay}
          maxDay={maxDay}
          onChange={(from, to) => onChange({ ...filters, from, to })}
        />
        <FiltersMenu dataset={dataset} filters={filters} onChange={onChange} />
      </div>
      <p className="flex w-full items-center gap-1.5 pl-0.5 text-xs text-slate-400">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.25v3.5M8 5.25v.01" strokeLinecap="round" />
        </svg>
        <span>Note: these filters apply to all tabs</span>
        {active && (
          <button
            type="button"
            className="ml-auto font-medium text-indigo-600 hover:underline"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Clear filters
          </button>
        )}
      </p>
    </div>
  )
}
