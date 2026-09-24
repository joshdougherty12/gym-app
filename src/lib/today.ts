import { effectiveWeek } from '../data/program'
import type { DayPlan, ProgramPause, Settings, WeekDefinition } from '../types'
import { pauseOn, programWeek } from './calendar'
import { weekdayOf, type IsoDate } from './dates'

export interface DayInfo {
  date: IsoDate
  /** null before the program start date. */
  week: number | null
  weekDef: WeekDefinition | null
  plan: DayPlan
  pause?: ProgramPause
}

export function dayInfo(date: IsoDate, settings: Pick<Settings, 'startDate' | 'pauses' | 'schedule'>): DayInfo {
  const week = programWeek(date, settings.startDate, settings.pauses)
  const pause = pauseOn(date, settings.pauses)
  return {
    date,
    week,
    weekDef: week === null ? null : effectiveWeek(week, pause?.kind === 'deload'),
    plan: settings.schedule[weekdayOf(date)],
    ...(pause ? { pause } : {}),
  }
}

export function planLabel(plan: DayPlan, sessionName: (id: string) => string): string {
  switch (plan.kind) {
    case 'session':
      return sessionName(plan.sessionId)
    case 'zone2':
      return `Off + ${plan.minutes} min zone 2`
    case 'walk':
      return 'Off + long walk'
    case 'rest':
      return 'Rest'
  }
}
