import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cleanEvents } from './clean'
import { loadDataset, type Dataset } from './model'
import { parseTimestamp } from './parse'
import { applyFilters, EMPTY_FILTERS, overview, stuckRows } from './selectors'
import type { KitEvent } from './types'

const sample = (name: string) => readFileSync(fileURLToPath(new URL(`../../public/data/${name}`, import.meta.url)), 'utf8')

describe('parseTimestamp', () => {
  it('reads Z, offsets and zone-less timestamps as the same instant', () => {
    const utc = Date.UTC(2026, 8, 3, 15, 55, 14)
    expect(parseTimestamp('2026-09-03T15:55:14Z')).toEqual({ ms: utc, format: 'utc' })
    expect(parseTimestamp('2026-09-03T10:55:14-05:00')).toEqual({ ms: utc, format: 'offset' })
    expect(parseTimestamp('2026-09-03 15:55:14')).toEqual({ ms: utc, format: 'naive' })
  })

  it('rejects garbage', () => {
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp('not a date')).toBeNull()
  })
})

describe('cleanEvents', () => {
  const base: KitEvent = {
    eventId: 'e1', orderId: 'o1', kitId: 'k1', type: 'kit_shipped', at: 0, raw: '', format: 'utc', source: 'system', line: 2,
  }

  it('treats the same instant written in two formats as a duplicate', () => {
    const a = { ...base, raw: '2026-09-03T15:55:14Z' }
    const b = { ...base, eventId: 'e2', raw: '2026-09-03T10:55:14-05:00' }
    const result = cleanEvents([a, b], new Set(['o1']))
    expect(result.events).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)
    expect(result.reformattedDuplicates).toBe(1)
  })

  it('drops events whose order does not exist', () => {
    expect(cleanEvents([base], new Set()).orphans).toHaveLength(1)
  })
})

describe('sample dataset', () => {
  const result = loadDataset(sample('orders.csv'), sample('kit_events.csv'), 'Sample')
  if (!result.ok) throw new Error(result.errors.join('; '))
  const ds: Dataset = result.dataset
  const rule = (label: string) => ds.rules.find((r) => r.label === label)!.count

  // Expected numbers come from an independent Python profile of the same files.
  it('reads every row', () => {
    expect(ds.orders).toHaveLength(5000)
    expect(ds.rowErrorCount).toBe(0)
  })

  it('finds the planted data problems', () => {
    expect(rule('Events for unknown orders (orphans)')).toBe(40)
    expect(rule('Duplicate events')).toBe(469)
    expect(rule('Timestamps with no time zone')).toBe(248)
    expect(rule('Timestamps with a UTC offset')).toBe(3289)
    expect(rule('Test orders')).toBe(67)
    expect(rule('Cancelled orders with kit events')).toBe(33)
    expect(rule('Paid kit orders with no events')).toBe(3)
  })

  it('infers missing scans', () => {
    const missing = (step: string) => ds.orders.flatMap((r) => r.kits).filter((k) => k.inferredSteps.includes(step as never)).length
    expect(missing('kit_delivered')).toBe(28)
    expect(missing('sample_mailed')).toBe(55)
  })

  it('takes the as-of date from the latest timestamp', () => {
    expect(new Date(ds.asOf).toISOString()).toBe('2026-10-19T23:46:00.000Z')
  })

  it('places paid, non-test orders in the right stage', () => {
    const records = applyFilters(ds.orders, EMPTY_FILTERS)
    const states = Object.fromEntries(overview(records, ds.asOf).states.map((s) => [s.key, s.onTrack + s.overdue]))
    expect(states).toMatchObject({
      in_transit: 40,
      with_customer: 677,
      sample_in_transit: 137,
      in_qc: 78,
      sequencing: 417,
      report_pending: 50,
    })
  })

  it('flags stuck kits against the stage targets', () => {
    const records = applyFilters(ds.orders, EMPTY_FILTERS)
    const byState = new Map<string, number>()
    for (const row of stuckRows(records, ds.asOf)) byState.set(row.state, (byState.get(row.state) ?? 0) + 1)
    expect(Object.fromEntries(byState)).toMatchObject({
      in_transit: 7,
      with_customer: 278,
      sample_in_transit: 4,
      in_qc: 2,
      sequencing: 22,
      report_pending: 5,
    })
    for (const id of ['ord_dpt1x', 'ord_88wy3', 'ord_nqx3a'])
      expect(stuckRows(records, ds.asOf).some((r) => r.record.order.orderId === id)).toBe(true)
  })

  it('rejects files with missing columns', () => {
    const bad = loadDataset('a,b\n1,2', sample('kit_events.csv'), 'Bad')
    expect(bad.ok).toBe(false)
  })
})
