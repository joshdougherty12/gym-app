import type { DayPlan, ReminderSettings, ReminderTone, Settings } from '../types'
import { addDays, weekdayOf, type IsoDate } from './dates'

export interface PlannedReminder {
  id: number
  at: Date
  title: string
  body: string
  kind: 'workout' | 'missed' | 'weigh-in'
}

export const REMINDER_DAYS = 14
const ID_BASE = { workout: 5000, missed: 6000, 'weigh-in': 7000 } as const
export const REMINDER_ID_RANGE = [5000, 7999] as const

type Msg = (session: string, minutes: number) => string

const WORKOUT: Record<ReminderTone, Msg[]> = {
  coach: [
    (s, m) => `${s} today, about ${m} min. Future you says thanks.`,
    (s) => `${s} is on the plan today. Show up and the rest takes care of itself.`,
    (s, m) => `${s} day. ${m} minutes, one set at a time.`,
    (s) => `Consistency beats intensity. ${s} today.`,
  ],
  drill: [
    (s) => `${s}. Today. No negotiations.`,
    (s, m) => `${m} minutes of ${s}. Shoes on. Out the door.`,
    (s) => `${s} doesn't care how you feel. Go.`,
    (s) => `You said you wanted this. ${s} today.`,
  ],
  buddy: [
    (s) => `${s} today! Your muscles called, they're bored.`,
    (s, m) => `${s} in the chat. ${m} min and you're a legend.`,
    (s) => `Hey. ${s}. You. Me (in spirit). Let's go 💪`,
    (s) => `${s} day: the couch will still be there after.`,
  ],
}

const MISSED: Record<ReminderTone, Msg[]> = {
  coach: [(s) => `Still time for ${s}. Even a short session counts.`, (s) => `No ${s} logged yet. 30 focused minutes beats zero.`],
  drill: [(s) => `${s} isn't going to do itself. 30 minutes. Go.`, (s) => `Nothing logged. ${s}. Now.`],
  buddy: [(s) => `${s} is feeling ghosted 👻 Quick session?`, (s) => `Psst. ${s}. It's not too late. I believe in you (mostly).`],
}

const WEIGH: Record<ReminderTone, string[]> = {
  coach: ['Morning weigh-in: bathroom first, then the scale. It keeps the weekly review honest.', 'Quick weigh-in before breakfast. Trends beat single days.'],
  drill: ['Scale. Now. Before coffee.', 'Weigh in. Log it. Move on.'],
  buddy: ['Step on the scale, it misses you.', 'Weigh-in time! The number is just data, not a verdict.'],
}

/** Stable pick per date, so the same day always gets the same line. */
function pick<T>(list: T[], date: IsoDate): T {
  let h = 0
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return list[h % list.length] as T
}

function at(date: IsoDate, hhmm: string): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const [h, mi] = hhmm.split(':').map(Number) as [number, number]
  return new Date(y, mo - 1, d, h ?? 0, mi ?? 0, 0, 0)
}

function planName(plan: DayPlan, sessionName: (id: string) => string): string | null {
  if (plan.kind === 'session') return sessionName(plan.sessionId)
  if (plan.kind === 'zone2') return `${plan.minutes} min of zone 2 cardio`
  return null
}

/**
 * Reminders for the next two weeks from today. Missed-workout nudges are
 * skipped for days that already have a finished workout. Past times are
 * dropped. IDs are stable per kind and day offset so a resync replaces them.
 */
export function planReminders(args: {
  reminders: ReminderSettings
  schedule: Settings['schedule']
  today: IsoDate
  now: Date
  sessionName: (id: string) => string
  sessionMinutes: (id: string) => number
  finishedDates: ReadonlySet<IsoDate>
}): PlannedReminder[] {
  const r = args.reminders
  const out: PlannedReminder[] = []
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const date = addDays(args.today, i)
    const plan = args.schedule[weekdayOf(date)]
    const name = planName(plan, args.sessionName)
    const minutes = plan.kind === 'session' ? args.sessionMinutes(plan.sessionId) : plan.kind === 'zone2' ? plan.minutes : 0
    if (r.workout && name) {
      out.push({ id: ID_BASE.workout + i, at: at(date, r.workoutTime), title: plan.kind === 'session' ? `${name} day` : 'Cardio day', body: pick(WORKOUT[r.tone], date)(name, minutes), kind: 'workout' })
    }
    if (r.missed && plan.kind === 'session' && name && !args.finishedDates.has(date)) {
      out.push({ id: ID_BASE.missed + i, at: at(date, r.missedTime), title: `Still time for ${name}?`, body: pick(MISSED[r.tone], date)(name, minutes), kind: 'missed' })
    }
    if (r.weighIn) {
      out.push({ id: ID_BASE['weigh-in'] + i, at: at(date, r.weighInTime), title: 'Weigh-in', body: pick(WEIGH[r.tone], date), kind: 'weigh-in' })
    }
  }
  return out.filter((x) => x.at.getTime() > args.now.getTime())
}

/** Rough session length: about 9 minutes per exercise, rounded to 5. */
export function estimateMinutes(exerciseCount: number): number {
  return Math.max(20, Math.round((exerciseCount * 9) / 5) * 5)
}
