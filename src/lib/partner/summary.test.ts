import { describe, expect, it } from 'vitest'
import type { Exercise, SetLog, WorkoutLog } from '../../types'
import { workoutSummary } from './summary'

const ex = (id: string, name: string, loading: Exercise['loading'] = 'external', type: Exercise['type'] = 'compound') => [id, { name, loading, type }] as const
const exercises = new Map([ex('bench', 'Bench press'), ex('pullup', 'Weighted pull-up', 'bodyweight-plus'), ex('plank', 'Plank', 'timed', 'timed')])
const set = (exerciseId: string, weightLb: number, reps: number, extra: Partial<SetLog> = {}): SetLog => ({ slotId: exerciseId, exerciseId, setIndex: 0, weightLb, reps, rir: 2, isWarmup: false, loggedAt: 1, ...extra })
const workout = (id: string, date: string, sets: SetLog[]): WorkoutLog => ({ id, date, weekNumber: 1, sessionTemplateId: 'upper', startedAt: Date.parse(`${date}T17:00:00Z`), finishedAt: Date.parse(`${date}T17:52:00Z`), notes: '', sets })

describe('workout summary for a partner', () => {
  const before = workout('w1', '2026-09-20', [set('bench', 175, 8), set('pullup', 20, 6)])
  const now = workout('w2', '2026-09-24', [set('bench', 95, 10, { isWarmup: true }), set('bench', 185, 8), set('bench', 185, 7), set('pullup', 25, 6), set('plank', 0, 60, { durationSec: 60 })])

  it('has the session, duration, working sets, records and best sets', () => {
    const s = workoutSummary(now, [before], exercises, 'Upper heavy')
    expect(s).toMatchObject({ date: '2026-09-24', name: 'Upper heavy', minutes: 52, setsDone: 4 })
    expect(s.prs.map((p) => `${p.exercise}:${p.kind}`)).toEqual(['Bench press:e1rm', 'Bench press:weight', 'Weighted pull-up:e1rm', 'Weighted pull-up:weight'])
    expect(s.best).toEqual([
      { exercise: 'Bench press', weightLb: 185, reps: 8, addedLoad: false },
      { exercise: 'Weighted pull-up', weightLb: 25, reps: 6, addedLoad: true },
    ])
  })

  it('never contains bodyweight', () => {
    const s = workoutSummary(now, [before], exercises, 'Upper heavy')
    const pull = s.prs.find((p) => p.exercise === 'Weighted pull-up' && p.kind === 'e1rm')
    // e1RM on the added 25 lb only (Epley 25 x (1 + 6/30) = 30), not bodyweight + 25.
    expect(pull?.valueLb).toBe(30)
    expect(Object.keys(s).sort()).toEqual(['best', 'date', 'finishedAt', 'minutes', 'name', 'prs', 'setsDone'])
  })
})
