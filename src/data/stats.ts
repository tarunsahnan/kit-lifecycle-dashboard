export function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export interface Summary {
  n: number
  median: number | null
  p90: number | null
  withinTarget: number | null
}

export function summarize(values: number[], targetDays?: number): Summary {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    n: sorted.length,
    median: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    withinTarget:
      targetDays === undefined || !sorted.length ? null : sorted.filter((v) => v <= targetDays).length / sorted.length,
  }
}
