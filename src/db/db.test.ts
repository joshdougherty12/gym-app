import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { CAUTIONS, EXERCISE_LIBRARY } from '../data/exercises'
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

describe('exercise descriptions', () => {
  it('every library exercise has a how-to description', () => {
    const missing = EXERCISE_LIBRARY.filter((e) => !e.description || e.description.length < 20).map((e) => e.id)
    expect(missing).toEqual([])
  })
})

describe('v3 joint-friendly program upgrade', () => {
  it('swaps untouched slots in a stored v2 program and leaves edited slots alone', async () => {
    const { default: Dexie } = await import('dexie')
    const name = `upgrade-test-${n++}`
    // A program as stored by an older version of the app (v2), with one slot the user edited.
    const old = new Dexie(name)
    old.version(2).stores({ settings: 'id', exercises: 'id, pattern', sessions: 'id', workouts: 'id, date, weekNumber, sessionTemplateId, [sessionTemplateId+date]' })
    const { SESSION_TEMPLATES: current } = await import('../data/program')
    const original = structuredClone([...current]).map((s) => ({
      ...s,
      slots: s.slots.map((slot) => {
        const back: Record<string, string> = { 'uh-5': 'cable-crunch', 'lh-1': 'back-squat', 'lh-2': 'romanian-deadlift', 'pl-1': 'barbell-row', 'pl-6': 'ab-wheel' }
        return back[slot.slotId] ? { ...slot, exerciseId: back[slot.slotId] as string } : slot
      }),
    }))
    const pull = original.find((s) => s.id === 'pull')!
    pull.slots = pull.slots.map((s) => (s.slotId === 'pl-6' ? { ...s, exerciseId: 'plank' } : s)) // user already swapped ab wheel -> plank
    await old.table('sessions').bulkPut(original)
    await old.table('workouts').put({ id: 'w1', date: '2026-09-25', weekNumber: 0, sessionTemplateId: 'pull', startedAt: 1, finishedAt: 2, notes: '', sets: [{ slotId: 'pl-1', exerciseId: 'barbell-row', setIndex: 0, weightLb: 135, reps: 8, rir: 2, isWarmup: false, loggedAt: 1 }] })
    old.close()

    const d = new CutlineDB(name)
    dbs.push(d)
    await d.open()
    const byId = new Map((await d.sessions.toArray()).map((s) => [s.id, s]))
    const ex = (sid: string, slot: string) => byId.get(sid)?.slots.find((s) => s.slotId === slot)?.exerciseId
    expect(ex('lower-heavy', 'lh-1')).toBe('leg-press')
    expect(ex('lower-heavy', 'lh-2')).toBe('hip-thrust')
    expect(ex('pull', 'pl-1')).toBe('incline-db-row')
    expect(ex('upper-heavy', 'uh-5')).toBe('side-plank')
    expect(ex('pull', 'pl-6')).toBe('plank') // user's own choice kept
    expect((await d.workouts.get('w1'))?.sets[0]?.exerciseId).toBe('barbell-row') // history untouched
    expect(await d.exercises.get('dead-bug')).toBeDefined() // new library exercise added
  })

  it('the shipped program avoids exercises flagged for the low back or knees', () => {
    const flagged = new Set(Object.entries(CAUTIONS).filter(([, c]) => c.includes('low-back') || c.includes('knees')).map(([id]) => id))
    const used = SESSION_TEMPLATES.flatMap((s) => s.slots.map((x) => x.exerciseId))
    expect(used.filter((id) => flagged.has(id))).toEqual([])
  })
})
