import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE } from '../data/program'
import { DEFAULT_REMINDERS } from '../db/defaults'
import { estimateMinutes, planReminders, REMINDER_DAYS, REMINDER_ID_RANGE } from './reminders'

const names: Record<string, string> = { 'upper-heavy': 'Upper', 'lower-heavy': 'Lower', push: 'Push', pull: 'Pull', 'legs-conditioning': 'Legs' }
const base = {
  schedule: DEFAULT_SCHEDULE,
  today: '2026-09-25', // Friday: Pull
  now: new Date(2026, 8, 25, 12, 0),
  sessionName: (id: string) => names[id] ?? id,
  sessionMinutes: () => 55,
  finishedDates: new Set<string>(),
}
const all = { ...DEFAULT_REMINDERS, workout: true, missed: true, weighIn: true }

describe('reminders', () => {
  it('is empty when everything is off', () => {
    expect(planReminders({ ...base, reminders: DEFAULT_REMINDERS })).toEqual([])
  })

  it('reminds on training days and zone 2 days, not rest or walk days', () => {
    const r = planReminders({ ...base, reminders: { ...DEFAULT_REMINDERS, workout: true } })
    const days = r.map((x) => x.at.getDay())
    expect(days).not.toContain(0) // Sunday walk
    expect(days).toContain(3) // Wednesday zone 2
    expect(r[0]?.title).toBe('Pull day')
    expect(r[0]?.body).toMatch(/Pull/)
  })

  it('drops reminders whose time has passed today', () => {
    const r = planReminders({ ...base, reminders: { ...all }, now: new Date(2026, 8, 25, 18, 0) })
    const today = r.filter((x) => x.at.getDate() === 25)
    expect(today.map((x) => x.kind)).toEqual(['missed']) // 17:00 workout and 07:00 weigh-in already passed
  })

  it('skips the missed-workout nudge once the day is logged', () => {
    const r = planReminders({ ...base, reminders: { ...all }, finishedDates: new Set(['2026-09-25']) })
    expect(r.some((x) => x.kind === 'missed' && x.at.getDate() === 25)).toBe(false)
    expect(r.some((x) => x.kind === 'missed' && x.at.getDate() === 26)).toBe(true)
  })

  it('uses stable ids inside the reserved range and covers two weeks', () => {
    const r = planReminders({ ...base, reminders: { ...all }, now: new Date(2026, 8, 25, 0, 0) })
    expect(r.every((x) => x.id >= REMINDER_ID_RANGE[0] && x.id <= REMINDER_ID_RANGE[1])).toBe(true)
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length)
    expect(r.filter((x) => x.kind === 'weigh-in')).toHaveLength(REMINDER_DAYS)
  })

  it('changes voice with the tone', () => {
    const coach = planReminders({ ...base, reminders: { ...DEFAULT_REMINDERS, workout: true, tone: 'coach' } })[0]?.body
    const drill = planReminders({ ...base, reminders: { ...DEFAULT_REMINDERS, workout: true, tone: 'drill' } })[0]?.body
    expect(coach).not.toBe(drill)
  })

  it('estimates session length', () => {
    expect(estimateMinutes(6)).toBe(55)
    expect(estimateMinutes(1)).toBe(20)
  })
})
