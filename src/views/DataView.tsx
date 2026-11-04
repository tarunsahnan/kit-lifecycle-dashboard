import { useRef, useState } from 'react'
import { Card } from '../components/ui'
import { loadDataset, type Dataset } from '../data/model'
import { fmtDateTime, fmtInt } from '../lib/format'

async function classify(files: File[]) {
  let orders: File | undefined
  let events: File | undefined
  for (const f of files) {
    const header = (await f.slice(0, 2048).text()).split(/\r?\n/)[0].toLowerCase()
    if (header.includes('event_type')) events = f
    else if (header.includes('created_at')) orders = f
  }
  return { orders, events }
}

export function DataView({ dataset, onLoaded, onReset, isSample }: {
  dataset: Dataset
  onLoaded: (d: Dataset) => void
  onReset: () => void
  isSample: boolean
}) {
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handle(fileList: FileList | null) {
    const files = [...(fileList ?? [])]
    setErrors([])
    if (files.length !== 2) {
      setErrors(['Choose both files together: the orders CSV and the kit events CSV.'])
      return
    }
    setBusy(true)
    try {
      const { orders, events } = await classify(files)
      if (!orders || !events) {
        setErrors([
          "Couldn't tell which file is which. The orders file needs a created_at column and the events file an event_type column.",
        ])
        return
      }
      const result = loadDataset(await orders.text(), await events.text(), `${orders.name} + ${events.name}`)
      if (result.ok) onLoaded(result.dataset)
      else setErrors(result.errors)
    } catch {
      setErrors(['Something went wrong reading those files. Check that they are plain CSV.'])
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Load your own data" subtitle="Two CSVs with the same columns as the sample. Files are processed in your browser and never uploaded.">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handle(e.dataTransfer.files)
          }}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'}`}
        >
          <p className="text-sm text-slate-600">Drop <code>orders.csv</code> and <code>kit_events.csv</code> here, or</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Loading…' : 'Choose both files'}
            </button>
            {!isSample && (
              <button type="button" onClick={onReset} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Back to sample data
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => handle(e.target.files)} />
        </div>
        {errors.length > 0 && (
          <ul className="mt-3 list-disc rounded-lg bg-rose-50 py-2 pl-8 pr-3 text-sm text-rose-800">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </Card>

      <Card
        title="How the data was cleaned"
        subtitle={`${dataset.label}. Latest timestamp ${fmtDateTime(dataset.asOf)}, used as the default date delays are counted up to.`}
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[35rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">What we found</th>
                <th className="px-3 py-2 text-right font-medium">Rows / orders</th>
                <th className="px-3 py-2 font-medium">What the dashboard does</th>
              </tr>
            </thead>
            <tbody>
              {dataset.rules.map((r) => (
                <tr key={r.label} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 align-top font-medium text-slate-800">{r.label}</td>
                  <td className={`px-3 py-2 text-right align-top tabular-nums ${r.count ? 'text-slate-900' : 'text-slate-400'}`}>{fmtInt(r.count)}</td>
                  <td className="px-3 py-2 align-top text-slate-600">{r.handling}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          A kit is <b>stuck</b> when a paid, non-test order has been in its current stage longer than that stage's target.
          Cancelled and refunded orders never count as stuck. Turnaround times use paid orders only.
        </p>
      </Card>

      {dataset.rowErrorCount > 0 && (
        <Card title={`Unreadable rows (${fmtInt(dataset.rowErrorCount)})`}>
          <ul className="max-h-64 overflow-y-auto font-mono text-xs text-slate-700">
            {dataset.rowErrors.map((e) => (
              <li key={`${e.file}-${e.line}`}>{e.file}.csv line {e.line}: {e.message}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
