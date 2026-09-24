import { addDays, weekdayOf, type IsoDate } from './dates'

/** The Sunday that ends the most recent complete week (today, if today is Sunday). */
export function lastReviewEnd(today: IsoDate): IsoDate {
  const wd = weekdayOf(today)
  return wd === 0 ? today : addDays(today, -wd)
}
