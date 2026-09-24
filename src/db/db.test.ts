import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY } from '../data/exercises'
import { SESSION_TEMPLATES } from '../data/program'
import { CutlineDB } from './db'
import { withDefaults } from './defaults'
import { getSettings, resetAllData, resetProgram, saveSession, updateSettings } from './repo'

let n = 0
const dbs: CutlineDB[] = []
function freshDb(): CutlineDB {
  const d = new CutlineDB(`test-${n++}`)
  dbs.push(d)
  return d
}

afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

describe('database', () => {
  it('seeds settings, the exercise library and the sessions on first open', async () => {
    const d = freshDb()
    await d.open()
    expect(await d.exercises.count()).toBe(EXERCISE_LIBRARY.length)
    expect(await d.sessions.count()).toBe(SESSION_TEMPLATES.length)
    const s = await getSettings(d)
    expect(s.calorieTarget).toBe(2450)
    expect(s.proteinTargetG).toBe(170)
    expect(s.stepGoal).toBe(9000)
    expect(s.units).toBe('imperial')
  })

  it('every session slot points at a library exercise', () => {
    const ids = new Set(EXERCISE_LIBRARY.map((e) => e.id))
    for (const s of SESSION_TEMPLATES) for (const slot of s.slots) expect(ids.has(slot.exerciseId), slot.exerciseId).toBe(true)
  })

  it('updates settings without losing other fields', async () => {
    const d = freshDb()
    await d.open()
    await updateSettings({ calorieTarget: 2300 }, d)
    const s = await getSettings(d)
    expect(s.calorieTarget).toBe(2300)
    expect(s.proteinTargetG).toBe(170)
  })

  it('adds new library exercises on open without overwriting edits', async () => {
    const d = freshDb()
    await d.open()
    const squat = await d.exercises.get('back-squat')
    if (!squat) throw new Error('missing')
    await d.exercises.put({ ...squat, incrementLb: 10 })
    await d.exercises.delete('pec-deck')
    d.close()
    await d.open()
    expect((await d.exercises.get('back-squat'))?.incrementLb).toBe(10)
    expect(await d.exercises.get('pec-deck')).toBeDefined()
  })

  it('resets the program but keeps logs', async () => {
    const d = freshDb()
    await d.open()
    const s = SESSION_TEMPLATES[0]
    if (!s) throw new Error('no sessions')
    await saveSession({ ...s, slots: [] }, d)
    await d.dailyLogs.put({ date: '2026-09-24', weightLb: 195 })
    await resetProgram(d)
    expect((await d.sessions.get(s.id))?.slots.length).toBe(s.slots.length)
    expect(await d.dailyLogs.count()).toBe(1)
  })

  it('reset all data returns to first-launch state', async () => {
    const d = freshDb()
    await d.open()
    await d.dailyLogs.put({ date: '2026-09-24', weightLb: 195 })
    await updateSettings({ calorieTarget: 2000 }, d)
    await resetAllData(d)
    expect(await d.dailyLogs.count()).toBe(0)
    expect((await getSettings(d)).calorieTarget).toBe(2450)
  })
})

describe('withDefaults', () => {
  it('fills fields missing from older stored settings', () => {
    const s = withDefaults({ calorieTarget: 2200, startDate: '2026-09-24' })
    expect(s.calorieTarget).toBe(2200)
    expect(s.proteinTargetG).toBe(170)
    expect(s.schedule[1]).toEqual({ kind: 'session', sessionId: 'upper-heavy' })
    expect(s.startDate).toBe('2026-09-24')
  })
})
