import { EXERCISE_LIBRARY, exerciseMap } from '../data/exercises'
import { DEFAULT_SCHEDULE, SESSION_TEMPLATES, effectiveWeek } from '../data/program'
import { defaultSettings } from '../db/defaults'
import { datesOfWeek, week1Monday } from '../lib/calendar'
import { addDays, daysBetween, weekdayOf } from '../lib/dates'
import { exerciseHistory } from '../lib/history'
import { suggest } from '../lib/progression'
import { plannedSets } from '../lib/weekPlan'
import type { CardioLog, DailyLog, Measurement, SetLog, Settings, WorkoutLog } from '../types'

/** Small deterministic RNG so the demo looks the same every time. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** Starting weights for the demo lifter (lb; dumbbells per hand). */
const START: Record<string, number> = {
  'incline-barbell-press': 135,
  'weighted-pull-up': 10,
  'seated-db-ohp': 45,
  'chest-supported-row': 90,
  'cable-crunch': 60,
  'back-squat': 185,
  'romanian-deadlift': 155,
  'walking-lunge': 35,
  'lying-leg-curl': 70,
  'standing-calf-raise': 120,
  'hanging-leg-raise': 0,
  'flat-db-press': 60,
  'cable-lateral-raise': 15,
  'low-to-high-cable-fly': 25,
  'overhead-triceps-extension': 40,
  'triceps-pushdown': 45,
  plank: 0,
  'barbell-row': 135,
  'neutral-grip-pulldown': 110,
  'face-pull': 40,
  'incline-db-curl': 25,
  'hammer-curl': 30,
  'ab-wheel': 0,
  'leg-press': 270,
  'bulgarian-split-squat': 35,
  'hip-thrust': 185,
  'seated-calf-raise': 90,
}

export interface DemoData {
  settings: Settings
  workouts: WorkoutLog[]
  dailyLogs: DailyLog[]
  measurements: Measurement[]
  cardio: CardioLog[]
}

/**
 * About ten weeks of plausible history ending `today`: daily weigh-ins
 * trending down ~0.7 lb/week with noise, nutrition and steps, weekly waist,
 * zone 2 cardio, and every scheduled workout, with weights chosen by the real
 * progression engine and the occasional missed rep.
 */
export function generateDemo(today: string, weeksBack = 10): DemoData {
  const rand = rng(42)
  const startDate = addDays(today, -7 * weeksBack - 3)
  const settings: Settings = { ...defaultSettings(startDate), schedule: structuredClone(DEFAULT_SCHEDULE) }
  const exercises = exerciseMap(EXERCISE_LIBRARY)
  const workouts: WorkoutLog[] = []
  const dailyLogs: DailyLog[] = []
  const measurements: Measurement[] = []
  const cardio: CardioLog[] = []

  const totalDays = daysBetween(startDate, today)
  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(startDate, i)
    const trend = 196 - (0.7 / 7) * i
    const log: DailyLog = { date }
    if (rand() < 0.88) log.weightLb = Math.round((trend + (rand() - 0.5) * 2.2) * 10) / 10
    if (rand() < 0.9) log.calories = Math.round((2450 + (rand() - 0.5) * 350) / 10) * 10
    if (rand() < 0.9) log.proteinG = Math.round(165 + (rand() - 0.4) * 30)
    log.steps = Math.round(9000 + (rand() - 0.45) * 5000)
    if (rand() < 0.7) log.fatigue = (rand() < 0.2 ? 3 : 2) as 2 | 3
    dailyLogs.push(log)
    if (weekdayOf(date) === 0 && i > 0) measurements.push({ date, waistIn: Math.round((36.5 - (i / 7) * 0.13 + (rand() - 0.5) * 0.2) * 4) / 4 })
    if (weekdayOf(date) === 3) cardio.push({ id: `demo-cardio-${i}`, date, kind: 'zone2', minutes: 30 })
    if (weekdayOf(date) === 0) cardio.push({ id: `demo-walk-${i}`, date, kind: 'walk', minutes: 50 })
  }

  const w1 = week1Monday(startDate)
  const lastWeek = Math.floor(daysBetween(w1, today) / 7) + 1
  for (let week = 0; week <= lastWeek; week++) {
    const def = effectiveWeek(week)
    for (const date of datesOfWeek(week, startDate)) {
      if (daysBetween(date, today) <= 0) continue // leave today for real use
      const plan = settings.schedule[weekdayOf(date)]
      if (plan.kind !== 'session') continue
      if (rand() < 0.06) continue // a missed session now and then
      const session = SESSION_TEMPLATES.find((s) => s.id === plan.sessionId)
      if (!session) continue
      const startedAt = Date.parse(`${date}T17:30:00`)
      const sets: SetLog[] = []
      let t = startedAt
      for (const slot of session.slots) {
        const e = exercises.get(slot.exerciseId)
        if (!e) continue
        const n = plannedSets(slot, e, def).sets
        if (e.type === 'cardio') {
          sets.push({ slotId: slot.slotId, exerciseId: e.id, setIndex: 0, weightLb: 0, reps: 0, rir: 0, isWarmup: false, loggedAt: (t += 60_000 * 10), durationSec: slot.repMin * 60 })
          continue
        }
        const history = exerciseHistory(workouts, e.id)
        const s = suggest({ exercise: e, repMin: slot.repMin, repMax: slot.repMax, sets: n, phase: def.phase, todayRir: def.targetRir, history })
        for (let i = 0; i < n; i++) {
          const target = s.sets[Math.min(i, s.sets.length - 1)]
          const weight = target?.weightLb ?? START[e.id] ?? 20
          let reps = target?.reps ?? slot.repMin
          // Late sets sometimes fall a rep short; fatigue builds across a block.
          if (i === n - 1 && rand() < 0.25) reps = Math.max(1, reps - 1)
          const rir = def.phase === 'deload' ? 4 : Math.max(0, Math.round(def.targetRir.min + rand() * (def.targetRir.max - def.targetRir.min)))
          t += 60_000 * 3
          if (e.type === 'timed') {
            sets.push({ slotId: slot.slotId, exerciseId: e.id, setIndex: i, weightLb: weight, reps: 0, rir, isWarmup: false, loggedAt: t, durationSec: target?.reps ?? slot.repMin })
          } else if (e.perSide) {
            sets.push({ slotId: slot.slotId, exerciseId: e.id, setIndex: i, weightLb: weight, reps, repsLeft: reps, repsRight: reps, rir, isWarmup: false, loggedAt: t })
          } else {
            sets.push({ slotId: slot.slotId, exerciseId: e.id, setIndex: i, weightLb: weight, reps, rir, isWarmup: false, loggedAt: t })
          }
        }
      }
      workouts.push({ id: `demo-${date}`, date, weekNumber: week, sessionTemplateId: session.id, startedAt, finishedAt: t + 5 * 60_000, notes: '', sets })
    }
  }

  return { settings, workouts, dailyLogs, measurements, cardio }
}
