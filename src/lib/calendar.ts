import type { ProgramPause } from '../types'
import { addDays, daysBetween, mondayOf, type IsoDate } from './dates'

/**
 * Program calendar.
 *
 * Week 0 runs from the start date up to the Sunday before the first Monday
 * after it. Week 1 starts on that Monday (or on the start date itself if it
 * is a Monday, in which case there is no week 0). A pause (whole weeks off,
 * from a Monday) holds the program at the week it started in; afterwards the
 * program resumes at that same week.
 */

/** Monday on which week 1 begins. */
export function week1Monday(startDate: IsoDate): IsoDate {
  const m = mondayOf(startDate)
  return m === startDate ? m : addDays(m, 7)
}

export function hasWeekZero(startDate: IsoDate): boolean {
  return week1Monday(startDate) !== startDate
}

/**
 * Weeks to subtract from the raw week for `date`. A pause of N weeks starting
 * on Monday S holds the program at S's week for N weeks: inside the pause it
 * subtracts the whole weeks elapsed since S, after it subtracts N.
 */
function pausedWeeksBefore(date: IsoDate, pauses: readonly ProgramPause[]): number {
  let total = 0
  for (const p of pauses) {
    const d = daysBetween(p.start, date)
    if (p.weeks > 0 && d >= 0) total += Math.min(p.weeks, Math.floor(d / 7))
  }
  return total
}

/** The pause covering this date, if any. */
export function pauseOn(date: IsoDate, pauses: readonly ProgramPause[]): ProgramPause | undefined {
  return pauses.find((p) => {
    const d = daysBetween(p.start, date)
    return p.weeks > 0 && d >= 0 && d < p.weeks * 7
  })
}

/** Program week for a date, or null if the date is before the program started. */
export function programWeek(date: IsoDate, startDate: IsoDate, pauses: readonly ProgramPause[] = []): number | null {
  if (daysBetween(startDate, date) < 0) return null
  const w1 = week1Monday(startDate)
  const offset = daysBetween(w1, date)
  if (offset < 0) return 0
  const raw = Math.floor(offset / 7) + 1
  return Math.max(0, raw - pausedWeeksBefore(date, pauses))
}

/**
 * The calendar dates (Monday..Sunday, clipped to the start date for week 0)
 * that currently belong to program week n. A paused week keeps the number it
 * will resume at, so a week can occur more than once; this returns the latest
 * occurrence, which is the one actually trained.
 */
export function datesOfWeek(n: number, startDate: IsoDate, pauses: readonly ProgramPause[] = []): IsoDate[] {
  const w1 = week1Monday(startDate)
  if (n === 0) {
    const len = daysBetween(startDate, w1)
    return Array.from({ length: len }, (_, i) => addDays(startDate, i))
  }
  let monday = w1
  let found: IsoDate | null = null
  for (let guard = 0; guard < 520; guard++) {
    const w = programWeek(monday, startDate, pauses)
    if (w === n) found = monday
    if (w !== null && w > n) break
    monday = addDays(monday, 7)
  }
  if (!found) return []
  const start = found
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}
