/** Short unique id for locally created records, e.g. "slot-mfx2k9-4f1a". */
export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}

/** Current time in ms (kept here so render-purity lint rules see event handlers correctly). */
export function timestamp(): number {
  return Date.now()
}
