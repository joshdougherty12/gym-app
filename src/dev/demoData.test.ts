import { describe, expect, it } from 'vitest'
import { programWeek } from '../lib/calendar'
import { exerciseHistory } from '../lib/history'
import { generateDemo } from './demoData'

describe('demo data', () => {
  const today = '2026-12-03'
  const d = generateDemo(today)

  it('starts about ten weeks back and never logs a workout today or later', () => {
    expect(programWeek(today, d.settings.startDate)).toBeGreaterThanOrEqual(9)
    expect(d.workouts.every((w) => w.date < today)).toBe(true)
    expect(d.workouts.length).toBeGreaterThan(35)
  })

  it('has enough weigh-ins for a weekly review and a downward trend', () => {
    const weights = d.dailyLogs.filter((l) => l.weightLb !== undefined)
    expect(weights.length).toBeGreaterThan(50)
    const first = weights.slice(0, 7).reduce((s, l) => s + (l.weightLb ?? 0), 0) / 7
    const last = weights.slice(-7).reduce((s, l) => s + (l.weightLb ?? 0), 0) / 7
    expect(last).toBeLessThan(first - 4)
  })

  it('progresses the squat over the block', () => {
    const h = exerciseHistory(d.workouts, 'back-squat')
    const newest = Math.max(...(h[0]?.sets.map((s) => s.weightLb) ?? [0]))
    const oldest = Math.max(...(h[h.length - 1]?.sets.map((s) => s.weightLb) ?? [0]))
    expect(newest).toBeGreaterThan(oldest)
  })

  it('is deterministic', () => {
    expect(JSON.stringify(generateDemo(today))).toBe(JSON.stringify(d))
  })
})
