import type { PhaseId, PhaseInfo, Schedule, SessionTemplate, WeekDefinition } from '../types'

/** Weeks 1-12 are the block; week 0 is the short intro before the first Monday. */
export const PROGRAM_WEEKS = 12

/** After week 12, every 5th week is a deload (the spec asks for every 4-6 weeks). */
export const EXTENSION_DELOAD_EVERY = 5

export const PHASES: Record<PhaseId, PhaseInfo> = {
  intro: {
    id: 'intro',
    name: 'Intro',
    weeks: 'Week 0',
    summary: 'Find starting weights. Low end of each rep range, 2-3 RIR, nothing heroic.',
  },
  base: {
    id: 'base',
    name: 'Build the base',
    weeks: 'Weeks 1-4',
    summary: '2-3 RIR on all sets. Start at the bottom of each rep range with a controlled weight. Double progression.',
  },
  push: {
    id: 'push',
    name: 'Push harder',
    weeks: 'Weeks 5-8',
    summary: '1-2 RIR. Extra set on lateral raises, rear delts and your weakest lift. Cardio bump.',
  },
  deload: {
    id: 'deload',
    name: 'Deload',
    weeks: 'Week 9 (then every 5th week after 12)',
    summary: 'About 40% fewer sets at 4 RIR. Keep the same weights. Steps and nutrition unchanged.',
  },
  peak: {
    id: 'peak',
    name: 'Peak',
    weeks: 'Weeks 10-12',
    summary: 'Last set of each main lift to 0-1 RIR, everything else 1-2 RIR. Beat your week 8 numbers.',
  },
  extension: {
    id: 'extension',
    name: 'Extension',
    weeks: 'Week 13+',
    summary: 'Weeks 5-8 style progression with a deload every 4-6 weeks.',
  },
}

export function weekDefinition(n: number): WeekDefinition {
  if (n <= 0) {
    return { number: 0, phase: 'intro', targetRir: { min: 2, max: 3 }, setMultiplier: 1, notes: PHASES.intro.summary }
  }
  if (n <= 4) {
    return { number: n, phase: 'base', targetRir: { min: 2, max: 3 }, setMultiplier: 1, notes: PHASES.base.summary }
  }
  if (n <= 8) {
    return { number: n, phase: 'push', targetRir: { min: 1, max: 2 }, setMultiplier: 1, notes: PHASES.push.summary }
  }
  if (n === 9) {
    return { number: 9, phase: 'deload', targetRir: { min: 4, max: 4 }, setMultiplier: 0.6, notes: PHASES.deload.summary }
  }
  if (n <= PROGRAM_WEEKS) {
    return {
      number: n,
      phase: 'peak',
      targetRir: { min: 1, max: 2 },
      setMultiplier: 1,
      mainLiftLastSetRir: { min: 0, max: 1 },
      notes: PHASES.peak.summary,
    }
  }
  // After week 12: weeks 5-8 style progression, with a deload every 5th week
  // (weeks 17, 22, 27...), i.e. four hard weeks then a deload.
  if (EXTENSION_DELOAD_EVERY > 0 && (n - PROGRAM_WEEKS) % EXTENSION_DELOAD_EVERY === 0) {
    return { number: n, phase: 'deload', targetRir: { min: 4, max: 4 }, setMultiplier: 0.6, notes: PHASES.deload.summary }
  }
  return { number: n, phase: 'extension', targetRir: { min: 1, max: 2 }, setMultiplier: 1, notes: PHASES.extension.summary }
}

/** Week definition for a workout: its week, or a deload version of it for an inserted deload week. */
export function effectiveWeek(n: number, deload?: boolean): WeekDefinition {
  const def = weekDefinition(n)
  if (!deload || def.phase === 'deload') return def
  return { number: n, phase: 'deload', targetRir: { min: 4, max: 4 }, setMultiplier: 0.6, notes: 'Extra deload week: ' + PHASES.deload.summary }
}

export const SESSION_TEMPLATES: readonly SessionTemplate[] = [
  {
    id: 'upper-heavy',
    name: 'Upper (heavy)',
    short: 'Upper',
    slots: [
      { slotId: 'uh-1', exerciseId: 'incline-barbell-press', sets: 4, repMin: 6, repMax: 6, isMainLift: true },
      { slotId: 'uh-2', exerciseId: 'weighted-pull-up', sets: 4, repMin: 6, repMax: 8, isMainLift: true },
      { slotId: 'uh-3', exerciseId: 'seated-db-ohp', sets: 3, repMin: 8, repMax: 8, isMainLift: true },
      { slotId: 'uh-4', exerciseId: 'chest-supported-row', sets: 3, repMin: 8, repMax: 10, isMainLift: true },
      { slotId: 'uh-5', exerciseId: 'cable-crunch', sets: 3, repMin: 12, repMax: 12, isMainLift: false },
    ],
  },
  {
    id: 'lower-heavy',
    name: 'Lower (heavy)',
    short: 'Lower',
    slots: [
      { slotId: 'lh-1', exerciseId: 'back-squat', sets: 4, repMin: 5, repMax: 6, isMainLift: true },
      { slotId: 'lh-2', exerciseId: 'romanian-deadlift', sets: 3, repMin: 8, repMax: 8, isMainLift: true },
      { slotId: 'lh-3', exerciseId: 'walking-lunge', sets: 3, repMin: 10, repMax: 10, isMainLift: false },
      { slotId: 'lh-4', exerciseId: 'lying-leg-curl', sets: 3, repMin: 10, repMax: 12, isMainLift: false },
      { slotId: 'lh-5', exerciseId: 'standing-calf-raise', sets: 4, repMin: 10, repMax: 10, isMainLift: false },
      { slotId: 'lh-6', exerciseId: 'hanging-leg-raise', sets: 3, repMin: 10, repMax: 12, isMainLift: false },
    ],
  },
  {
    id: 'push',
    name: 'Push',
    short: 'Push',
    slots: [
      { slotId: 'pu-1', exerciseId: 'flat-db-press', sets: 3, repMin: 8, repMax: 10, isMainLift: false },
      { slotId: 'pu-2', exerciseId: 'cable-lateral-raise', sets: 4, repMin: 12, repMax: 15, isMainLift: false },
      { slotId: 'pu-3', exerciseId: 'low-to-high-cable-fly', sets: 3, repMin: 12, repMax: 15, isMainLift: false },
      { slotId: 'pu-4', exerciseId: 'overhead-triceps-extension', sets: 3, repMin: 10, repMax: 12, isMainLift: false },
      { slotId: 'pu-5', exerciseId: 'triceps-pushdown', sets: 2, repMin: 12, repMax: 15, isMainLift: false },
      { slotId: 'pu-6', exerciseId: 'plank', sets: 3, repMin: 45, repMax: 60, isMainLift: false },
    ],
  },
  {
    id: 'pull',
    name: 'Pull',
    short: 'Pull',
    slots: [
      { slotId: 'pl-1', exerciseId: 'barbell-row', sets: 4, repMin: 8, repMax: 10, isMainLift: true },
      { slotId: 'pl-2', exerciseId: 'neutral-grip-pulldown', sets: 3, repMin: 10, repMax: 12, isMainLift: false },
      { slotId: 'pl-3', exerciseId: 'face-pull', sets: 4, repMin: 15, repMax: 15, isMainLift: false },
      { slotId: 'pl-4', exerciseId: 'incline-db-curl', sets: 3, repMin: 10, repMax: 12, isMainLift: false },
      { slotId: 'pl-5', exerciseId: 'hammer-curl', sets: 2, repMin: 12, repMax: 12, isMainLift: false },
      { slotId: 'pl-6', exerciseId: 'ab-wheel', sets: 3, repMin: 8, repMax: 12, isMainLift: false },
    ],
  },
  {
    id: 'legs-conditioning',
    name: 'Legs + conditioning',
    short: 'Legs',
    slots: [
      { slotId: 'lc-1', exerciseId: 'leg-press', sets: 4, repMin: 10, repMax: 12, isMainLift: false },
      { slotId: 'lc-2', exerciseId: 'bulgarian-split-squat', sets: 3, repMin: 8, repMax: 10, isMainLift: false },
      { slotId: 'lc-3', exerciseId: 'hip-thrust', sets: 3, repMin: 10, repMax: 10, isMainLift: false },
      { slotId: 'lc-4', exerciseId: 'seated-calf-raise', sets: 3, repMin: 15, repMax: 15, isMainLift: false },
      { slotId: 'lc-5', exerciseId: 'bike-intervals', sets: 1, repMin: 10, repMax: 10, isMainLift: false, note: '30s hard / 60s easy' },
    ],
  },
]

export const DEFAULT_SCHEDULE: Schedule = {
  1: { kind: 'session', sessionId: 'upper-heavy' },
  2: { kind: 'session', sessionId: 'lower-heavy' },
  3: { kind: 'zone2', minutes: 30 },
  4: { kind: 'session', sessionId: 'push' },
  5: { kind: 'session', sessionId: 'pull' },
  6: { kind: 'session', sessionId: 'legs-conditioning' },
  0: { kind: 'walk' },
}
