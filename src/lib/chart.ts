// Recharts sizes axes and margins in SVG units (numbers only); text and HTML parts use rem.
export const TICK = { fontSize: '0.75rem', fill: '#64748b' }
export const GRID = '#e2e8f0'

export const tooltipProps = {
  contentStyle: {
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 0.25rem 0.75rem rgb(15 23 42 / 0.08)',
    fontSize: '0.8125rem',
  },
  cursor: { fill: 'rgb(99 102 241 / 0.06)' },
}

export const legendProps = { wrapperStyle: { fontSize: '0.75rem', paddingTop: '0.5rem' }, iconType: 'circle' as const, iconSize: 8 }
