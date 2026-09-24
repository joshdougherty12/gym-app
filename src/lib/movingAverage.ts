import { daysBetween, type IsoDate } from './dates'

export interface DatedValue {
  date: IsoDate
  value: number
}

/**
 * Trailing moving average over a calendar window (default 7 days): for each
 * entry, the mean of all entries dated within the previous `windowDays` days
 * including itself. Missing days are simply absent, not zero.
 */
export function movingAverage(points: readonly DatedValue[], windowDays = 7): DatedValue[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return sorted.map((p) => {
    const inWindow = sorted.filter((q) => {
      const d = daysBetween(q.date, p.date)
      return d >= 0 && d < windowDays
    })
    const mean = inWindow.reduce((s, q) => s + q.value, 0) / inWindow.length
    return { date: p.date, value: mean }
  })
}
