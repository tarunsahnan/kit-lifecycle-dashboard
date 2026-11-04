const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export const fmtDate = (ms: number) => dateFmt.format(ms)
export const fmtDateTime = (ms: number) => `${dateTimeFmt.format(ms)} UTC`
export const fmtShort = (ms: number) => shortFmt.format(ms)
export const fmtInt = (n: number) => n.toLocaleString('en-US')
export const fmtPct = (p: number | null) => (p === null ? '–' : `${Math.round(p * 100)}%`)
export const fmtDays = (d: number | null | undefined) =>
  d === null || d === undefined ? '–' : `${d < 10 ? d.toFixed(1) : Math.round(d)}d`

const PRODUCT_LABELS: Record<string, string> = {
  wgs_30x: 'WGS 30x',
  wgs_100x: 'WGS 100x',
  upload_only: 'Upload only',
}
export const productLabel = (p: string) => PRODUCT_LABELS[p] ?? p

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
export function countryName(code: string) {
  try {
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

const PRODUCT_COLORS = ['#4f46e5', '#0d9488', '#d97706', '#db2777', '#64748b']
export const productColor = (p: string, products: string[]) =>
  PRODUCT_COLORS[Math.max(0, products.indexOf(p)) % PRODUCT_COLORS.length]

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob([rows.map((r) => r.map(escape).join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
