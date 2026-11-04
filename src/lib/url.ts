import { EMPTY_FILTERS, type Filters } from '../data/selectors'

export const TABS = ['overview', 'turnaround', 'stuck', 'orders', 'data'] as const
export type Tab = (typeof TABS)[number]

export interface UrlState {
  tab: Tab
  order: string | null
  filters: Filters
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function readUrl(): UrlState {
  const p = new URLSearchParams(window.location.search)
  const list = (key: string) => (p.get(key) ?? '').split(',').filter(Boolean)
  const day = (key: string) => (DAY.test(p.get(key) ?? '') ? p.get(key) : null)
  const tab = p.get('tab') as Tab
  return {
    tab: TABS.includes(tab) ? tab : 'overview',
    order: p.get('order'),
    filters: {
      ...EMPTY_FILTERS,
      from: day('from'),
      to: day('to'),
      products: list('product'),
      countries: list('country'),
      includeTest: p.get('test') === '1',
    },
  }
}

export function writeUrl(s: UrlState) {
  const p = new URLSearchParams()
  if (s.tab !== 'overview') p.set('tab', s.tab)
  if (s.order) p.set('order', s.order)
  if (s.filters.from) p.set('from', s.filters.from)
  if (s.filters.to) p.set('to', s.filters.to)
  if (s.filters.products.length) p.set('product', s.filters.products.join(','))
  if (s.filters.countries.length) p.set('country', s.filters.countries.join(','))
  if (s.filters.includeTest) p.set('test', '1')
  const qs = p.toString()
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
}
