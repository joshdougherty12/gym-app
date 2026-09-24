import type { DayPlan, Schedule, Weekday } from '../types'

export const WEEK_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0]

function samePlan(a: DayPlan, b: DayPlan): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'session' && b.kind === 'session') return a.sessionId === b.sessionId
  return true
}

/**
 * Put `plan` on `day`. If that session is already scheduled on another day the
 * two days swap, so every session stays in the week exactly once.
 */
export function assignDay(schedule: Schedule, day: Weekday, plan: DayPlan): Schedule {
  const next: Schedule = { ...schedule }
  const current = schedule[day]
  if (plan.kind === 'session') {
    const other = WEEK_ORDER.find((d) => d !== day && samePlan(schedule[d], plan))
    if (other !== undefined) next[other] = current
  }
  next[day] = plan
  return next
}

export function swapDays(schedule: Schedule, a: Weekday, b: Weekday): Schedule {
  return { ...schedule, [a]: schedule[b], [b]: schedule[a] }
}

export function sessionDays(schedule: Schedule): { day: Weekday; sessionId: string }[] {
  const out: { day: Weekday; sessionId: string }[] = []
  for (const d of WEEK_ORDER) {
    const p = schedule[d]
    if (p.kind === 'session') out.push({ day: d, sessionId: p.sessionId })
  }
  return out
}
