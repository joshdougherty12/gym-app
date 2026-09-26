import { DEFAULT_INCREMENTS, REST_BY_TYPE } from '../data/exercises'
import { DEFAULT_SCHEDULE } from '../data/program'
import { todayIso } from '../lib/dates'
import type { Settings } from '../types'

/** Starting dietary notes (editable in Settings). */
export const DEFAULT_FOOD_NOTES =
  'High cholesterol on recent bloodwork: keep saturated fat low, limit fried food, processed and fatty red meat, butter and full-fat dairy. Favor fiber (oats, beans, lentils, vegetables, fruit, whole grains), fish, skinless poultry, olive oil and nuts in moderation. Budget-friendly, easy to cook.'

export function defaultSettings(startDate: string = todayIso()): Settings {
  return {
    units: 'imperial',
    theme: 'system',
    calorieTarget: 2450,
    proteinTargetG: 170,
    stepGoal: 9000,
    lossRateMinLb: 0.5,
    lossRateMaxLb: 1.0,
    restCompoundSec: REST_BY_TYPE.compound,
    restIsolationSec: REST_BY_TYPE.isolation,
    restTimedSec: REST_BY_TYPE.timed,
    timerSound: true,
    timerVibrate: true,
    workoutView: 'single',
    incrementDefaults: { ...DEFAULT_INCREMENTS },
    startDate,
    pauses: [],
    schedule: structuredClone(DEFAULT_SCHEDULE),
    goal: 'cut',
    foodNotes: DEFAULT_FOOD_NOTES,
    householdSize: 2,
    satFatLimitG: 15,
    fiberTargetG: 30,
  }
}

/**
 * Stored settings merged over defaults, so a field added in a later app
 * version gets its default instead of undefined.
 */
export function withDefaults(stored: Partial<Settings> | undefined): Settings {
  const base = defaultSettings(stored?.startDate)
  if (!stored) return base
  return {
    ...base,
    ...stored,
    incrementDefaults: { ...base.incrementDefaults, ...stored.incrementDefaults },
    schedule: { ...base.schedule, ...stored.schedule },
  }
}
