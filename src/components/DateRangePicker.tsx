import { useState } from 'react'
import { addDays, datePresets, formatRange, parseDay, rangeLabel } from '../lib/dates'
import { CalendarIcon, TriggerButton, usePopover } from './Popover'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

interface Draft {
  from: string | null
  to: string | null
}

function Month({ index, draft, hover, minDay, maxDay, onPick, onHover }: {
  index: number
  draft: Draft
  hover: string | null
  minDay: string
  maxDay: string
  onPick: (day: string) => void
  onHover: (day: string | null) => void
}) {
  const year = Math.floor(index / 12)
  const month = index % 12
  const first = Date.UTC(year, month, 1)
  const offset = (new Date(first).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const days = Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, month, i + 1)).toISOString().slice(0, 10))

  // While picking the end date, preview the range up to the hovered day.
  const from = draft.from
  const to = draft.to ?? (from && hover && hover >= from ? hover : null)

  return (
    <div className="w-full sm:w-60">
      <div className="mb-2 text-center text-sm font-semibold text-slate-700">{monthFmt.format(first)}</div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => onHover(null)}>
        {Array.from({ length: offset }, (_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const disabled = day < minDay || day > maxDay
          const isEdge = day === from || day === to
          const inRange = from && to && day > from && day < to
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onPick(day)}
              onMouseEnter={() => onHover(day)}
              className={`h-9 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : isEdge
                    ? 'rounded-md bg-indigo-600 font-semibold text-white'
                    : inRange
                      ? 'bg-indigo-50 text-indigo-900'
                      : 'rounded-md text-slate-700 hover:bg-slate-100'
              }`}
            >
              {Number(day.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const monthIndex = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1

export function DateRangePicker({ from, to, minDay, maxDay, onChange }: {
  from: string | null
  to: string | null
  minDay: string
  maxDay: string
  onChange: (from: string | null, to: string | null) => void
}) {
  const { open, setOpen, ref } = usePopover()
  const [draft, setDraft] = useState<Draft>({ from, to })
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState(monthIndex(to ?? maxDay) - 1)
  const [lastN, setLastN] = useState('')
  const presets = datePresets(maxDay)

  // Fill the "Last N days" box only when the range really is the last N days.
  const daysBack = (f: string | null, t: string | null) =>
    f && t === maxDay ? String(Math.round((parseDay(t) - parseDay(f)) / 86_400_000) + 1) : ''

  const openPicker = () => {
    setDraft({ from, to })
    setLastN(daysBack(from, to))
    setView(monthIndex(to ?? maxDay) - 1)
    setOpen(!open)
  }

  const pick = (day: string) => {
    const next =
      !draft.from || draft.to
        ? { from: day, to: null }
        : day < draft.from
          ? { from: day, to: draft.from }
          : { from: draft.from, to: day }
    setDraft(next)
    setLastN(daysBack(next.from, next.to))
  }

  const setPreset = (pFrom: string | null, pTo: string | null) => {
    setDraft({ from: pFrom, to: pTo })
    setLastN(daysBack(pFrom, pTo))
    if (pTo) setView(monthIndex(pTo) - 1)
  }

  const apply = () => {
    onChange(draft.from, draft.to ?? draft.from)
    setOpen(false)
  }

  const activePreset = presets.find((p) => p.from === draft.from && p.to === draft.to)
  const n = Number(lastN)
  const validN = Number.isInteger(n) && n >= 1 && n <= 3650

  return (
    <div className="sm:relative" ref={ref}>
      <TriggerButton active={Boolean(from || to)} open={open} onClick={openPicker} icon={CalendarIcon}>
        {rangeLabel(from, to, maxDay)}
      </TriggerButton>

      {open && (
        <div className="absolute inset-x-0 z-30 mt-2 sm:left-auto sm:right-0 sm:w-[min(calc(100vw-2rem),50rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex flex-col sm:flex-row">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2 sm:w-44 sm:shrink-0 sm:flex-col sm:border-b-0 sm:border-r sm:p-3">
              <div className="hidden px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:block">Presets</div>
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPreset(p.from, p.to)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    activePreset?.key === p.key ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex-1 p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                Last
                <input
                  type="number"
                  min={1}
                  value={lastN}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isInteger(v) && v >= 1 && v <= 3650) setPreset(addDays(maxDay, -(v - 1)), maxDay)
                    setLastN(e.target.value)
                  }}
                  placeholder="–"
                  className={`h-8 w-16 rounded-md border px-2 text-sm ${validN || !lastN ? 'border-slate-300' : 'border-rose-400'}`}
                  aria-label="Number of days"
                />
                days, up to the latest data ({formatRange(maxDay, maxDay)})
              </div>

              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setView(view - 1)}
                  className="mt-0.5 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="flex flex-1 justify-center gap-6">
                  <div className="hidden sm:block">
                    <Month index={view} draft={draft} hover={hover} minDay={minDay} maxDay={maxDay} onPick={pick} onHover={setHover} />
                  </div>
                  <Month index={view + 1} draft={draft} hover={hover} minDay={minDay} maxDay={maxDay} onPick={pick} onHover={setHover} />
                </div>
                <button
                  type="button"
                  onClick={() => setView(view + 1)}
                  className="mt-0.5 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <span className="text-sm text-slate-600">
              {draft.from
                ? draft.to
                  ? formatRange(draft.from, draft.to)
                  : `${formatRange(draft.from, draft.from)}, pick an end date`
                : 'All dates'}
              {draft.from && draft.to && (
                <span className="text-slate-400"> · {Math.round((parseDay(draft.to) - parseDay(draft.from)) / 86_400_000) + 1} days</span>
              )}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={apply} className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
