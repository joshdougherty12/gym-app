// Domain types. Everything is stored in lb / inches; units only change display.

export type ExerciseType = 'compound' | 'isolation' | 'timed' | 'cardio'

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'cardio'

/**
 * How load is expressed:
 * - external: the weight field is the load (barbell total, or per dumbbell).
 * - bodyweight-plus: the weight field is ADDED load; e1RM uses bodyweight + added.
 * - timed: progression is in seconds (repMin/repMax are seconds).
 * - cardio: repMin/repMax are minutes.
 */
export type Loading = 'external' | 'bodyweight-plus' | 'timed' | 'cardio'

export type MovementPattern =
  | 'horizontal-press'
  | 'vertical-press'
  | 'vertical-pull'
  | 'horizontal-pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'knee-flexion'
  | 'calf'
  | 'lateral-raise'
  | 'chest-fly'
  | 'triceps'
  | 'rear-delt'
  | 'biceps'
  | 'hip-extension'
  | 'core'
  | 'conditioning'

export type Muscle =
  | 'chest'
  | 'back'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'

export const MUSCLES: readonly Muscle[] = [
  'chest',
  'back',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
]

/** What a timed exercise does once it reaches the top of its time range. */
export type TimedProgression = 'add-weight' | 'harder-variation'

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  equipment: Equipment
  loading: Loading
  pattern: MovementPattern
  /** Primary muscles count as a full set toward weekly volume. */
  primaryMuscles: Muscle[]
  /** Secondary muscles count as half a set. */
  secondaryMuscles: Muscle[]
  /** Reps (or seconds) are logged per side. */
  perSide: boolean
  /** Smallest sensible jump in the weight field, in lb. 0 = bodyweight only. */
  incrementLb: number
  alternates: string[]
  timedProgression?: TimedProgression
  /** Created by the user rather than shipped in the library. */
  custom?: boolean
}

export interface ExerciseSlot {
  /** Stable across swaps, so a slot keeps its place when its exercise changes. */
  slotId: string
  exerciseId: string
  sets: number
  /** Reps; seconds for timed exercises; minutes for cardio. */
  repMin: number
  repMax: number
  isMainLift: boolean
  /** Overrides the exercise's rest default when set. */
  restSec?: number
  note?: string
}

export interface SessionTemplate {
  id: string
  name: string
  short: string
  slots: ExerciseSlot[]
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday, as Date#getDay

export type DayPlan =
  | { kind: 'session'; sessionId: string }
  | { kind: 'zone2'; minutes: number }
  | { kind: 'walk' }
  | { kind: 'rest' }

export type Schedule = Record<Weekday, DayPlan>

export type PhaseId = 'intro' | 'base' | 'push' | 'deload' | 'peak' | 'extension'

export interface RirRange {
  min: number
  max: number
}

export interface WeekDefinition {
  number: number
  phase: PhaseId
  targetRir: RirRange
  /** Multiplier applied to every slot's sets (deload = 0.6). */
  setMultiplier: number
  /** Last set of each main lift goes to this RIR (peak weeks). */
  mainLiftLastSetRir?: RirRange
  notes: string
}

export interface PhaseInfo {
  id: PhaseId
  name: string
  weeks: string
  summary: string
}

/**
 * A program shift (illness, travel): `weeks` whole weeks off starting on the
 * Monday `start`. The program holds at the week it was in and resumes there
 * afterwards. Whole weeks keep program weeks aligned with the Mon-Sun
 * schedule. Logged workouts keep the week number they were logged under.
 */
export interface ProgramPause {
  id: string
  /** Monday the shift takes effect, YYYY-MM-DD. */
  start: string
  weeks: number
  note?: string
}

export type Units = 'imperial' | 'metric'
export type ThemePref = 'system' | 'dark' | 'light'
export type WorkoutView = 'single' | 'list'

export interface Settings {
  units: Units
  theme: ThemePref
  calorieTarget: number
  proteinTargetG: number
  stepGoal: number
  lossRateMinLb: number
  lossRateMaxLb: number
  restCompoundSec: number
  restIsolationSec: number
  restTimedSec: number
  timerSound: boolean
  timerVibrate: boolean
  workoutView: WorkoutView
  /** Default increment per equipment type, used for new/custom exercises. */
  incrementDefaults: Record<Equipment, number>
  /** Day the program started (week 0 begins here), YYYY-MM-DD. */
  startDate: string
  pauses: ProgramPause[]
  schedule: Schedule
  /** Cutting until the week-12 decision; 'surplus' after choosing a small surplus. */
  goal: 'cut' | 'surplus'
  week12Decision?: Week12Decision
}

export interface Week12Decision {
  choice: 'continue-cut' | 'surplus'
  decidedAt: number
  /** Estimated maintenance when choosing the surplus. */
  maintenanceKcal?: number
}

/** Per-week choices: extra sets, weakest lift, cardio bump. */
export interface WeekOverride {
  weekNumber: number
  /** slotId -> extra sets for that week. */
  extraSets: Record<string, number>
  weakestLiftSlotId?: string
  cardioBump?: 'extra-zone2' | 'longer-finisher'
  shouldersCoreBonus?: boolean
}

export interface SetLog {
  slotId: string
  exerciseId: string
  setIndex: number
  weightLb: number
  /** Reps for normal exercises; the weaker side's reps for per-side ones. */
  reps: number
  repsLeft?: number
  repsRight?: number
  rir: number
  isWarmup: boolean
  durationSec?: number
  loggedAt: number
}

export interface WorkoutLog {
  id: string
  /** YYYY-MM-DD */
  date: string
  weekNumber: number
  sessionTemplateId: string
  startedAt: number
  finishedAt?: number
  notes: string
  sets: SetLog[]
  exerciseNotes?: Record<string, string>
}

export interface DailyLog {
  date: string
  weightLb?: number
  steps?: number
  calories?: number
  proteinG?: number
  fatigue?: 1 | 2 | 3 | 4 | 5
}

export type CardioKind = 'zone2' | 'finisher' | 'walk' | 'other'

export interface CardioLog {
  id: string
  date: string
  kind: CardioKind
  minutes: number
  notes?: string
}

export interface Measurement {
  date: string
  waistIn: number
}

export type PhotoAngle = 'front' | 'side' | 'back'

export interface Photo {
  id: string
  date: string
  angle: PhotoAngle
  blob: Blob
}

export type ReviewKind =
  | 'insufficient-data'
  | 'losing-fast'
  | 'on-track'
  | 'watch'
  | 'too-slow'
  | 'gaining'
  | 'surplus-too-fast'
  | 'surplus-losing'

export interface WeeklyReview {
  weekNumber: number
  createdAt: number
  avgWeightLb?: number
  prevAvgWeightLb?: number
  deltaLb?: number
  weighInCount: number
  kind: ReviewKind
  recommendation: string
  suggestedCalorieDelta?: number
  suggestedStepDelta?: number
  choice?: 'calories' | 'steps' | 'dismissed'
  /** Calorie change actually applied when accepted. */
  appliedCalorieDelta?: number
  accepted: boolean
}

/** The in-progress workout, saved on every change so a refresh loses nothing. */
export interface ActiveWorkout {
  id: 'current'
  workout: WorkoutLog
  /** Slot edits made during this session only (swaps, added/removed sets, warm-ups). */
  slotOverrides: Record<string, SlotOverride>
  /** Unlogged values typed into set rows, keyed by row key. Saved so a refresh keeps them. */
  drafts: Record<string, DraftSet>
  updatedAt: number
}

export interface SlotOverride {
  exerciseId?: string
  /** Change to the planned working sets for this workout only. */
  setDelta?: number
  warmups?: number
}

export interface DraftSet {
  weightLb: number
  reps: number
  repsLeft?: number
  repsRight?: number
  rir: number
  durationSec?: number
}
