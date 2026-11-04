import type { KitEvent, Order } from './types'

export function dedupeOrders(orders: Order[]) {
  const seen = new Map<string, Order>()
  const duplicates: Order[] = []
  for (const o of orders) {
    if (seen.has(o.orderId)) duplicates.push(o)
    else seen.set(o.orderId, o)
  }
  return { orders: [...seen.values()], duplicates }
}

export interface CleanEvents {
  events: KitEvent[]
  duplicates: KitEvent[]
  // Duplicates whose timestamp text differs from the copy we kept (same instant, different format).
  reformattedDuplicates: number
  orphans: KitEvent[]
}

// A duplicate is the same kit, event type and instant. Compared after parsing,
// so "…T14:59:46Z" and "…T10:59:46-04:00" are the same event.
export function cleanEvents(events: KitEvent[], orderIds: Set<string>): CleanEvents {
  const kept = new Map<string, KitEvent>()
  const duplicates: KitEvent[] = []
  const orphans: KitEvent[] = []
  let reformattedDuplicates = 0

  for (const e of events) {
    if (!orderIds.has(e.orderId)) {
      orphans.push(e)
      continue
    }
    const key = `${e.orderId}|${e.kitId}|${e.type}|${e.at}`
    const first = kept.get(key)
    if (first) {
      duplicates.push(e)
      if (first.raw !== e.raw) reformattedDuplicates++
      continue
    }
    kept.set(key, e)
  }
  return { events: [...kept.values()], duplicates, reformattedDuplicates, orphans }
}
