import { describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY, exerciseMap } from '../data/exercises'
import type { Profile } from '../types'
import { allowed, generateProgram } from './programGen'
import { bmr, heartHealthy, maintenance, targetsFor } from './targets'

const lib = exerciseMap(EXERCISE_LIBRARY)

const josh: Profile = {
  sex: 'male',
  age: 26,
  heightIn: 73,
  weightLb: 195,
  goal: 'lose-fat',
  pace: 'steady',
  experience: 'experienced',
  daysPerWeek: 5,
  sessionMinutes: 60,
  equipment: ['barbell', 'dumbbells', 'cables', 'machines', 'pullup-bar', 'bench', 'cardio'],
  limitations: ['low-back', 'knees'],
  limitationNotes: '',
  dietStyle: 'anything',
  allergies: [],
  healthNotes: 'High cholesterol',
  budget: 'tight',
  createdAt: 0,
}

describe('targets', () => {
  it('computes Mifflin-St Jeor resting energy', () => {
    // 88.45 kg, 185.42 cm, 26 y, male: 884.5 + 1158.9 - 130 + 5 = 1918.4
    expect(bmr(josh)).toBeCloseTo(1918.4, 0)
    expect(bmr({ ...josh, sex: 'female' })).toBeCloseTo(1918.4 - 166, 0)
  })

  it('lands near the hand-set targets for the original user', () => {
    const t = targetsFor(josh)
    const tdee = maintenance(josh)
    expect(tdee).toBeGreaterThan(2800)
    expect(tdee).toBeLessThan(3100)
    expect(t.calorieTarget).toBeGreaterThanOrEqual(2350)
    expect(t.calorieTarget).toBeLessThanOrEqual(2600)
    expect(t.calorieTarget % 25).toBe(0)
    expect(t.proteinTargetG).toBeGreaterThanOrEqual(165)
    expect(t.proteinTargetG).toBeLessThanOrEqual(180)
    expect(t.goal).toBe('cut')
    expect(t.lossRateMinLb).toBeGreaterThan(0)
    expect(t.lossRateMaxLb).toBeGreaterThan(t.lossRateMinLb)
  })

  it('uses a tighter saturated-fat limit when health notes mention cholesterol', () => {
    expect(heartHealthy('High cholesterol on my last CMP')).toBe(true)
    expect(heartHealthy('none')).toBe(false)
    const withHeart = targetsFor(josh)
    const without = targetsFor({ ...josh, healthNotes: '' })
    expect(withHeart.satFatLimitG).toBeLessThan(without.satFatLimitG)
    expect(withHeart.satFatLimitG).toBeGreaterThanOrEqual(14)
    expect(withHeart.satFatLimitG).toBeLessThanOrEqual(18)
  })

  it('builds a surplus for muscle gain and never goes below the calorie floor', () => {
    expect(targetsFor({ ...josh, goal: 'build-muscle' }).goal).toBe('surplus')
    expect(targetsFor({ ...josh, goal: 'build-muscle' }).calorieTarget).toBeGreaterThan(maintenance(josh))
    const small: Profile = { ...josh, sex: 'female', age: 60, heightIn: 60, weightLb: 105, daysPerWeek: 2, pace: 'aggressive' }
    expect(targetsFor(small).calorieTarget).toBeGreaterThanOrEqual(1200)
  })

  it('caps protein for very heavy people at a healthier reference weight', () => {
    expect(targetsFor({ ...josh, weightLb: 380 }).proteinTargetG).toBeLessThan(260)
  })
})

describe('program generator', () => {
  const ids = (p: Profile) => generateProgram(p, lib).sessions.flatMap((s) => s.slots.map((x) => x.exerciseId))

  it('never picks exercises flagged for the user\'s limitations', () => {
    for (const id of ids(josh)) {
      const c = lib.get(id)?.cautions ?? []
      expect(c.filter((x) => josh.limitations.includes(x)), id).toEqual([])
    }
  })

  it('builds the right number of sessions and schedules them', () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const g = generateProgram({ ...josh, daysPerWeek: d }, lib)
      expect(g.sessions).toHaveLength(d)
      const scheduled = Object.values(g.schedule).filter((x) => x.kind === 'session')
      expect(scheduled).toHaveLength(d)
      for (const s of g.sessions) expect(s.slots.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('uses only bodyweight moves for a no-equipment home user', () => {
    const home: Profile = { ...josh, equipment: [], limitations: [], daysPerWeek: 3 }
    for (const id of ids(home)) expect(lib.get(id)?.equipment, id).toBe('bodyweight')
    expect(ids(home).length).toBeGreaterThanOrEqual(9)
  })

  it('works with dumbbells and a bench only', () => {
    const db: Profile = { ...josh, equipment: ['dumbbells', 'bench'], limitations: [], daysPerWeek: 4 }
    for (const id of ids(db)) {
      const e = lib.get(id)
      expect(e && allowed(e, db.equipment, []), id).toBe(true)
    }
  })

  it('keeps sessions within the time budget', () => {
    const short = generateProgram({ ...josh, sessionMinutes: 30 }, lib)
    for (const s of short.sessions) expect(s.slots.length).toBeLessThanOrEqual(4)
  })

  it('avoids overhead pressing for shoulder problems', () => {
    const sh: Profile = { ...josh, limitations: ['shoulders'] }
    expect(ids(sh)).not.toContain('seated-db-ohp')
    expect(ids(sh)).not.toContain('standing-barbell-ohp')
  })

  it('gives beginners fewer sets and higher reps on main lifts', () => {
    const g = generateProgram({ ...josh, experience: 'new' }, lib)
    const main = g.sessions[0]?.slots.find((s) => s.isMainLift)
    expect(main?.sets).toBe(3)
    expect(main?.repMin).toBe(8)
  })

  it('every exercise it picks exists in the library', () => {
    for (const d of [2, 3, 4, 5, 6]) for (const id of ids({ ...josh, daysPerWeek: d, limitations: [] })) expect(lib.has(id), id).toBe(true)
  })
})
