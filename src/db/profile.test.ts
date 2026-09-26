import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Profile } from '../types'
import { CutlineDB } from './db'
import { applyProfile } from './profile'
import { getSettings } from './repo'

const dbs: CutlineDB[] = []
let n = 0
const fresh = async () => {
  const d = new CutlineDB(`profile-test-${n++}`)
  dbs.push(d)
  await d.open()
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

const p: Profile = {
  sex: 'female', age: 34, heightIn: 65, weightLb: 160, goal: 'build-muscle', pace: 'steady', experience: 'some',
  daysPerWeek: 3, sessionMinutes: 45, equipment: ['dumbbells', 'bench'], limitations: ['knees'], limitationNotes: '',
  dietStyle: 'vegetarian', allergies: ['Peanuts'], healthNotes: '', budget: 'moderate', createdAt: 1,
}

describe('applyProfile', () => {
  it('sets up a new user: targets, program, schedule and start date', async () => {
    const d = await fresh()
    await applyProfile(p, { updateTargets: true, rebuildProgram: true, startToday: true }, '2026-10-01', d)
    const s = await getSettings(d)
    expect(s.profile?.age).toBe(34)
    expect(s.startDate).toBe('2026-10-01')
    expect(s.goal).toBe('surplus')
    const sessions = await d.sessions.toArray()
    expect(sessions.map((x) => x.id).sort()).toEqual(['full-a', 'full-b', 'full-c'])
    expect(Object.values(s.schedule).filter((x) => x.kind === 'session')).toHaveLength(3)
    expect(s.foodNotes).not.toMatch(/cholesterol/i)
  })

  it('leaves an existing user\'s program, targets and start date alone unless asked', async () => {
    const d = await fresh()
    const before = await getSettings(d)
    const sessionsBefore = await d.sessions.toArray()
    await applyProfile(p, { updateTargets: false, rebuildProgram: false, startToday: false }, '2026-10-01', d)
    const s = await getSettings(d)
    expect(s.profile).toBeDefined()
    expect(s.calorieTarget).toBe(before.calorieTarget)
    expect(s.startDate).toBe(before.startDate)
    expect(s.schedule).toEqual(before.schedule)
    expect(await d.sessions.toArray()).toEqual(sessionsBefore)
  })
})
