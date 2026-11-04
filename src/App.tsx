import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilterBar } from './components/FilterBar'
import { loadDataset, type Dataset } from './data/model'
import { applyFilters, EMPTY_FILTERS, stuckRows, type Filters } from './data/selectors'
import { readUrl, writeUrl, type Tab } from './lib/url'
import { DataView } from './views/DataView'
import { OrderDetail } from './views/OrderDetail'
import { Orders } from './views/Orders'
import { Overview } from './views/Overview'
import { Stuck } from './views/Stuck'
import { Turnaround } from './views/Turnaround'

const SAMPLE_LABEL = 'Sample data (export of 20 Oct 2026)'

async function loadSample(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL
  const [orders, events] = await Promise.all(
    ['orders.csv', 'kit_events.csv'].map(async (f) => {
      const res = await fetch(`${base}data/${f}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.text()
    }),
  )
  const result = loadDataset(orders, events, SAMPLE_LABEL)
  if (!result.ok) throw new Error(result.errors.join('; '))
  return result.dataset
}

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  turnaround: 'Turnaround',
  stuck: 'Stuck kits',
  orders: 'Orders',
  data: 'Data',
}

export default function App() {
  const [initial] = useState(readUrl)
  const [sample, setSample] = useState<Dataset | null>(null)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [filters, setFilters] = useState<Filters>(initial.filters)
  const [orderId, setOrderId] = useState<string | null>(initial.order)

  useEffect(() => {
    loadSample()
      .then((d) => {
        setSample(d)
        setDataset(d)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => writeUrl({ tab, filters, order: orderId }), [tab, filters, orderId])

  // Delays are measured up to the latest timestamp in the data, not today: the CSVs are an export.
  const asOf = dataset?.asOf ?? 0
  const records = useMemo(() => (dataset ? applyFilters(dataset.orders, filters) : []), [dataset, filters])
  const stuckCount = useMemo(() => stuckRows(records, asOf).length, [records, asOf])
  const closeOrder = useCallback(() => setOrderId(null), [])

  const switchDataset = (d: Dataset) => {
    setDataset(d)
    setFilters(EMPTY_FILTERS)
    setOrderId(null)
    setTab('overview')
  }

  if (loadError)
    return <div className="p-8 text-center text-slate-600">Couldn't load the sample data. Refresh to try again.</div>
  if (!dataset) return <div className="p-8 text-center text-slate-500">Loading data…</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="z-10 border-b border-slate-200 bg-white/95 backdrop-blur sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12s10 6 10 6M8 7h8M8 17h8" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Kit Lifecycle Dashboard</h1>
              <p className="text-sm text-slate-500">
                {dataset.label}
                {dataset !== sample && (
                  <button type="button" className="ml-2 font-medium text-indigo-600 hover:underline" onClick={() => sample && switchDataset(sample)}>
                    Back to sample
                  </button>
                )}
              </p>
            </div>
          </div>
          <div className="relative flex w-full flex-wrap items-start justify-end gap-2 sm:static sm:w-auto">
            <FilterBar
              dataset={dataset}
              filters={filters}
              onChange={setFilters}
              maxDay={new Date(dataset.asOf).toISOString().slice(0, 10)}
              disabled={tab === 'data'}
            />
            <div className="hidden h-9 w-px bg-slate-200 sm:block" aria-hidden />
            <button
              type="button"
              onClick={() => setTab('data')}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Load CSVs
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Sections">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {TAB_LABELS[t]}
              {t === 'stuck' && stuckCount > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 text-xs text-rose-700">{stuckCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-5 pb-8 sm:px-6">
        {tab === 'overview' && <Overview records={records} products={dataset.products} asOf={asOf} onOpenStuck={() => setTab('stuck')} />}
        {tab === 'turnaround' && <Turnaround records={records} products={dataset.products} />}
        {tab === 'stuck' && <Stuck records={records} asOf={asOf} onOpenOrder={setOrderId} />}
        {tab === 'orders' && <Orders records={records} asOf={asOf} onOpenOrder={setOrderId} />}
        {tab === 'data' && (
          <DataView dataset={dataset} onLoaded={switchDataset} onReset={() => sample && switchDataset(sample)} isSample={dataset === sample} />
        )}
      </main>

      {orderId && (
        <OrderDetail
          record={dataset.byOrderId.get(orderId) ?? dataset.byKitId.get(orderId) ?? null}
          orderId={orderId}
          asOf={asOf}
          onClose={closeOrder}
        />
      )}
    </div>
  )
}
