// Calendar dates are local YYYY-MM-DD strings. All arithmetic goes through UTC
// so daylight-saving changes can never make a day 23 or 25 hours long.

export type IsoDate = string

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function toUtcMs(d: IsoDate): number {
  const m = ISO_RE.exec(d)
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${d}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function isIsoDate(d: string): boolean {
  if (!ISO_RE.test(d)) return false
  return fromUtcMs(toUtcMs(d)) === d
}

/** Today in the device's local time zone. */
export function todayIso(now: Date = new Date()): IsoDate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(d) + n * 86_400_000)
}

/** b - a in whole days. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000)
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(d: IsoDate): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(toUtcMs(d)).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

/** The Monday on or before d. */
export function mondayOf(d: IsoDate): IsoDate {
  const wd = weekdayOf(d)
  return addDays(d, wd === 0 ? -6 : 1 - wd)
}

/** The first Monday strictly after d. */
export function nextMonday(d: IsoDate): IsoDate {
  return addDays(mondayOf(d), 7)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** "Sep 24" */
export function shortDate(d: IsoDate): string {
  const m = ISO_RE.exec(d)
  if (!m) return d
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`
}
