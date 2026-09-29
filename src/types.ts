// Domain types. Everything is stored in lb / inches; units only change display.

export type ExerciseType = 'compound' | 'isolation' | 'timed' | 'cardio'

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'cardio'

/**
 * How load is expressed:
 * - external: the weight field is the load (barbell total, or per dumbbell).
 * - bodyweight-plus: the weight field is ADDED load; e1RM uses bodyweight + added.
 * - assisted: the weight field is ASSISTANCE (an assisted pull-up machine's counterweight);
 *   less is harder, progression lowers it, e1RM uses bodyweight − assistance.
 * - timed: progression is in seconds (repMin/repMax are seconds).
 * - cardio: repMin/repMax are minutes.
 */
export type Loading = 'external' | 'bodyweight-plus' | 'assisted' | 'timed' | 'cardio'

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

export type Caution = 'low-back' | 'knees' | 'shoulders'

export interface Exercise {
  id: string
  name: string
  /** Short how-to shown in the app. */
  description?: string
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
  /** Joints this exercise loads hard, shown as warnings when picking or swapping. */
  cautions?: Caution[]
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
  /** off = weeks off (default); deload = an extra deload week inserted here. */
  kind?: 'off' | 'deload'
  note?: string
}

export type Units = 'imperial' | 'metric'
export type ThemePref = 'system' | 'dark' | 'light'
/**
 * Accent color. Barbie pink also swaps checkmarks for hearts and scatters little
 * hearts on the background; seasonal follows the calendar (lib/seasons.ts).
 */
export type AccentPref = 'seasonal' | 'orange' | 'pink' | 'olive'
export type WorkoutView = 'single' | 'list'

export interface Settings {
  units: Units
  theme: ThemePref
  /** Unset: picked per phone (see lib/accent.ts). */
  accent?: AccentPref
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
  /** Dietary notes sent with every meal request (health, dislikes, allergies). */
  foodNotes: string
  /** People eating the planned dinners (for grocery quantities). */
  householdSize: number
  satFatLimitG: number
  fiberTargetG: number
  /** Set by first-time setup; absent for a brand-new install. */
  profile?: Profile
  reminders: ReminderSettings
  /** What this phone shares with a linked partner. */
  partner: PartnerSettings
  /** GPS activity tracker preferences. */
  activity: ActivitySettings
}

export interface ActivitySettings {
  autoPause: boolean
  /** Vibrate (Android) or beep at each mile or km. */
  splitCue: boolean
  lastType: ActivityType
  /** The first-run explanation has been shown. */
  introSeen: boolean
  /** Live map shown while tracking (collapsed saves battery and data). */
  showMap: boolean
}

/** Partner link sharing choices. More toggles can be added here; defaults come from withDefaults. */
export interface PartnerSettings {
  /** Name shown to the partner; empty uses the profile name. */
  name: string
  shareWorkouts: boolean
  shareCalorieTarget: boolean
  /** Share today's step count (off unless turned on). */
  shareSteps: boolean
  /** Share run, walk and ride summaries: type, date, distance, time, pace (1.10.0). */
  shareActivities: boolean
  /** Also share each activity's route on a map, for 30 days (1.10.1). Only while shareActivities is on. */
  shareRoutes: boolean
}

export type Sex = 'male' | 'female' | 'unspecified'
export type Goal = 'lose-fat' | 'build-muscle' | 'recomp' | 'strength' | 'health'
export type Pace = 'gentle' | 'steady' | 'aggressive'
export type Experience = 'new' | 'some' | 'experienced'
export type EquipmentItem = 'barbell' | 'dumbbells' | 'cables' | 'machines' | 'pullup-bar' | 'bench' | 'cardio'
export type DietStyle = 'anything' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'halal' | 'kosher'
export type Budget = 'tight' | 'moderate' | 'flexible'

/** Everything first-time setup asks, used to tailor targets, the program and the meal AI. */
export interface Profile {
  name?: string
  sex: Sex
  age: number
  heightIn: number
  /** Weight at setup; the weekly review uses the logged weigh-ins after that. */
  weightLb: number
  goal: Goal
  pace: Pace
  experience: Experience
  daysPerWeek: number
  sessionMinutes: number
  equipment: EquipmentItem[]
  limitations: Caution[]
  limitationNotes: string
  dietStyle: DietStyle
  allergies: string[]
  healthNotes: string
  budget: Budget
  createdAt: number
}

export type ReminderTone = 'coach' | 'drill' | 'buddy'

export interface ReminderSettings {
  workout: boolean
  /** "HH:MM" local time on training days. */
  workoutTime: string
  missed: boolean
  missedTime: string
  weighIn: boolean
  weighInTime: string
  tone: ReminderTone
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
  /** Logged during an inserted extra deload week. */
  deload?: boolean
  startedAt: number
  finishedAt?: number
  notes: string
  sets: SetLog[]
  exerciseNotes?: Record<string, string>
}

/** Where a day's step count came from. */
export type StepSource = 'sensor' | 'health-import' | 'manual'

export interface DailyLog {
  date: string
  weightLb?: number
  /** The day's steps as used everywhere (manual wins over counted or imported). */
  steps?: number
  /** Absent on logs from before 1.9.0, which were all typed in (manual). */
  stepsSource?: StepSource
  calories?: number
  proteinG?: number
  fatigue?: 1 | 2 | 3 | 4 | 5
}

// run, bike and hike (1.10.0) come from GPS-tracked activities.
export type CardioKind = 'zone2' | 'finisher' | 'walk' | 'other' | 'run' | 'bike' | 'hike'

/** Steps counted by the phone or imported from Apple Health for one day (the check-in uses it unless a manual value was typed). */
export interface StepDay {
  date: string
  steps: number
  source: Exclude<StepSource, 'manual'>
  updatedAt: number
}

export interface CardioLog {
  id: string
  date: string
  kind: CardioKind
  minutes: number
  notes?: string
  /** Set when the entry was made by a GPS-tracked activity (same id as the activity). */
  activityId?: string
  distanceM?: number
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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealItem {
  name: string
  portion: string
  calories: number
  proteinG: number
  satFatG?: number
  fiberG?: number
}

/** A logged meal. Photo meals carry Claude's estimate, which the user can adjust. */
export interface Meal {
  id: string
  date: string
  loggedAt: number
  mealType: MealType
  name: string
  items: MealItem[]
  calories: number
  proteinG: number
  carbsG?: number
  fatG?: number
  satFatG?: number
  fiberG?: number
  confidence?: 'low' | 'medium' | 'high'
  notes?: string
  /** Small thumbnail of the meal photo (local only). */
  photo?: Blob
  /** photo = Claude from a photo, text = Claude from a description, recipe = a suggested or saved recipe. */
  source: 'photo' | 'text' | 'manual' | 'suggestion' | 'recipe'
}

/** A recipe the user saved from Claude's suggestions. Numbers are per serving. */
export interface Recipe {
  id: string
  savedAt: number
  name: string
  servings: number
  ingredients: string[]
  steps: string[]
  tip?: string
  prepMinutes?: number
  calories: number
  proteinG: number
  satFatG?: number
  fiberG?: number
  carbsG?: number
  fatG?: number
}

/** Cached AI results: meal ideas per day/meal, and the current week plan. */
export interface AiCacheRow {
  id: string
  createdAt: number
  data: unknown
}

/** Secrets stay on the device and are never included in backups. */
export interface SecretRow {
  id: 'anthropic'
  apiKey: string
}

/** One grocery list item. Shared with a linked partner item by item. */
export interface GroceryItem {
  id: string
  /** Which list it belongs to; rebuilding the list starts a new one. */
  listId: string
  section: string
  item: string
  quantity: string
  estCostUsd: number
  order: number
  checked: boolean
}

/**
 * This phone's partner link: the household credentials (never backed up,
 * never logged) and sync progress.
 */
export interface PartnerLinkRow {
  id: 'link'
  householdId: string
  /** Household secret the server checks (it stores only a hash). */
  secret: string
  /** Encryption root key; never leaves the phone except inside the link code. */
  rootKey: string
  memberId: string
  role: 'creator' | 'joiner'
  /** waiting = created, partner not joined yet. */
  status: 'waiting' | 'linked'
  createdAt: number
  /** Last server version pulled. */
  cursor: number
  lastSyncAt?: number
}

export interface SyncOutboxRow {
  key: string
  type: string
  id: string
  attempts: number
  nextAttemptAt: number
}

/** Last-writer-wins timestamp per shared record ("type:id"). */
export interface SyncMetaRow {
  key: string
  ts: number
}

/** Shared records that live only in sync: member profiles, workout summaries, high-fives and nudges. */
export interface PartnerRecordRow {
  key: string
  type: 'member' | 'wsum' | 'event' | 'steps' | 'asum' | 'aroute'
  id: string
  /** Member id of the phone that wrote it. */
  by: string
  ts: number
  data: unknown
  /** Local only: handled or dismissed on this phone. */
  seen?: boolean
  /** Local only: an Android notification was shown. */
  notified?: boolean
}

// ---- GPS activities (1.10.0) ----

export type ActivityType = 'run' | 'walk' | 'bike' | 'hike'

/** One GPS fix. t = wall-clock ms; acc = horizontal accuracy (m); alt = altitude (m); spd = reported speed (m/s). */
export interface TrackPoint {
  t: number
  lat: number
  lon: number
  acc?: number
  alt?: number
  spd?: number
}

/** Manual pause and resume, and a gap where tracking was interrupted (app or service restarted). */
export interface TrackEvent {
  t: number
  kind: 'pause' | 'resume' | 'gap'
}

/** Stored route point: [seconds since start, lat, lon, elevation m or null]. */
export type RoutePoint = [number, number, number, number | null]

export interface ActivitySplit {
  /** 1-based mile or km number. */
  index: number
  distanceM: number
  movingMs: number
}

/** A finished GPS activity. The route is the smoothed track simplified to about 3 m (see lib/activity/route.ts). */
export interface Activity {
  id: string
  type: ActivityType
  /** Local date the activity started, YYYY-MM-DD. */
  date: string
  startedAt: number
  endedAt: number
  movingMs: number
  elapsedMs: number
  distanceM: number
  /** Approximate (GPS altitude, 3 m hysteresis); absent without altitude data. */
  elevationGainM?: number
  avgSpeedMps: number
  /** Split length used: 1609.344 (mile) or 1000 (km). */
  splitM: number
  splits: ActivitySplit[]
  calories?: number
  /** One array per continuous segment (a pause or interruption starts a new one). */
  route: RoutePoint[][]
  source: 'android' | 'web'
  autoPause: boolean
  notes?: string
}

/** The activity being tracked right now (one at most). */
export interface ActiveActivity {
  id: 'current'
  activityId: string
  type: ActivityType
  startedAt: number
  source: 'android' | 'web'
  events: TrackEvent[]
  autoPause: boolean
  splitCue: boolean
  splitM: number
}

/** Web only: GPS fixes of the activity in progress, one row each, so a reload loses nothing. */
export interface ActivityPointRow extends TrackPoint {
  id?: number
  activityId: string
}
