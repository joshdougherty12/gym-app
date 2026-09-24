import { DEFAULT_INCREMENTS, REST_BY_TYPE } from '../data/exercises'
import { DEFAULT_SCHEDULE } from '../data/program'
import { todayIso } from '../lib/dates'
import type { Settings } from '../types'

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
