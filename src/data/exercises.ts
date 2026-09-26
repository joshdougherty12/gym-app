import { EXERCISE_DESCRIPTIONS } from './descriptions'
import type { Equipment, Exercise, ExerciseType, Loading, MovementPattern, Muscle } from '../types'

/**
 * Increment defaults match the gym: plates come in 2.5 lb, so a barbell (or a
 * plate-loaded machine loaded on both sides) moves 5 lb; dumbbells jump 5 lb;
 * most selectorised machines and cable stacks can do 2.5 lb.
 * The weight field is the barbell total, or ONE dumbbell's weight.
 */
export const DEFAULT_INCREMENTS: Record<Equipment, number> = {
  barbell: 5,
  dumbbell: 5,
  machine: 2.5,
  cable: 2.5,
  bodyweight: 2.5,
  cardio: 0,
}

export const REST_BY_TYPE: Record<ExerciseType, number> = {
  compound: 150,
  isolation: 75,
  timed: 60,
  cardio: 0,
}

interface Def {
  id: string
  name: string
  type: ExerciseType
  equipment: Equipment
  pattern: MovementPattern
  primary: Muscle[]
  secondary?: Muscle[]
  loading?: Loading
  perSide?: boolean
  incrementLb?: number
  timedProgression?: Exercise['timedProgression']
}

function ex(d: Def): Exercise {
  const loading: Loading =
    d.loading ?? (d.type === 'timed' ? 'timed' : d.type === 'cardio' ? 'cardio' : 'external')
  return {
    id: d.id,
    name: d.name,
    ...(EXERCISE_DESCRIPTIONS[d.id] ? { description: EXERCISE_DESCRIPTIONS[d.id] } : {}),
    type: d.type,
    equipment: d.equipment,
    loading,
    pattern: d.pattern,
    primaryMuscles: d.primary,
    secondaryMuscles: d.secondary ?? [],
    perSide: d.perSide ?? false,
    incrementLb: d.incrementLb ?? DEFAULT_INCREMENTS[d.equipment],
    alternates: [],
    ...(d.timedProgression ? { timedProgression: d.timedProgression } : {}),
  }
}

const defs: Def[] = [
  // Horizontal press
  { id: 'incline-barbell-press', name: 'Incline barbell press', type: 'compound', equipment: 'barbell', pattern: 'horizontal-press', primary: ['chest'], secondary: ['front-delts', 'triceps'] },
  { id: 'incline-db-press', name: 'Incline dumbbell press', type: 'compound', equipment: 'dumbbell', pattern: 'horizontal-press', primary: ['chest'], secondary: ['front-delts', 'triceps'] },
  { id: 'flat-db-press', name: 'Flat dumbbell press', type: 'compound', equipment: 'dumbbell', pattern: 'horizontal-press', primary: ['chest'], secondary: ['front-delts', 'triceps'] },
  { id: 'flat-barbell-bench', name: 'Flat barbell bench press', type: 'compound', equipment: 'barbell', pattern: 'horizontal-press', primary: ['chest'], secondary: ['front-delts', 'triceps'] },
  { id: 'machine-chest-press', name: 'Machine chest press', type: 'compound', equipment: 'machine', pattern: 'horizontal-press', primary: ['chest'], secondary: ['front-delts', 'triceps'] },
  { id: 'incline-smith-press', name: 'Incline Smith machine press', type: 'compound', equipment: 'barbell', pattern: 'horizontal-press', primary: ['chest'], secondary: ['front-delts', 'triceps'] },

  // Vertical pull
  { id: 'weighted-pull-up', name: 'Weighted pull-up', type: 'compound', equipment: 'bodyweight', loading: 'bodyweight-plus', pattern: 'vertical-pull', primary: ['back'], secondary: ['biceps'] },
  { id: 'chin-up', name: 'Weighted chin-up', type: 'compound', equipment: 'bodyweight', loading: 'bodyweight-plus', pattern: 'vertical-pull', primary: ['back'], secondary: ['biceps'] },
  { id: 'lat-pulldown', name: 'Lat pulldown', type: 'compound', equipment: 'cable', pattern: 'vertical-pull', primary: ['back'], secondary: ['biceps'] },
  { id: 'neutral-grip-pulldown', name: 'Neutral-grip pulldown', type: 'compound', equipment: 'cable', pattern: 'vertical-pull', primary: ['back'], secondary: ['biceps'] },

  // Vertical press
  { id: 'seated-db-ohp', name: 'Seated dumbbell overhead press', type: 'compound', equipment: 'dumbbell', pattern: 'vertical-press', primary: ['front-delts'], secondary: ['side-delts', 'triceps'] },
  { id: 'standing-barbell-ohp', name: 'Standing barbell overhead press', type: 'compound', equipment: 'barbell', pattern: 'vertical-press', primary: ['front-delts'], secondary: ['side-delts', 'triceps', 'core'] },
  { id: 'machine-shoulder-press', name: 'Machine shoulder press', type: 'compound', equipment: 'machine', pattern: 'vertical-press', primary: ['front-delts'], secondary: ['side-delts', 'triceps'] },

  // Horizontal pull
  { id: 'chest-supported-row', name: 'Chest-supported row', type: 'compound', equipment: 'machine', pattern: 'horizontal-pull', primary: ['back'], secondary: ['rear-delts', 'biceps'] },
  { id: 'barbell-row', name: 'Barbell row', type: 'compound', equipment: 'barbell', pattern: 'horizontal-pull', primary: ['back'], secondary: ['rear-delts', 'biceps'] },
  { id: 'seated-cable-row', name: 'Seated cable row', type: 'compound', equipment: 'cable', pattern: 'horizontal-pull', primary: ['back'], secondary: ['rear-delts', 'biceps'] },
  { id: 'one-arm-db-row', name: 'One-arm dumbbell row', type: 'compound', equipment: 'dumbbell', pattern: 'horizontal-pull', primary: ['back'], secondary: ['rear-delts', 'biceps'], perSide: true },
  { id: 'incline-db-row', name: 'Incline dumbbell row', type: 'compound', equipment: 'dumbbell', pattern: 'horizontal-pull', primary: ['back'], secondary: ['rear-delts', 'biceps'] },

  // Squat
  { id: 'back-squat', name: 'Back squat', type: 'compound', equipment: 'barbell', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'] },
  { id: 'front-squat', name: 'Front squat', type: 'compound', equipment: 'barbell', pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'core'] },
  { id: 'hack-squat', name: 'Hack squat', type: 'compound', equipment: 'machine', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], incrementLb: 5 },
  { id: 'leg-press', name: 'Leg press', type: 'compound', equipment: 'machine', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], incrementLb: 5 },
  { id: 'pendulum-squat', name: 'Pendulum squat', type: 'compound', equipment: 'machine', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], incrementLb: 5 },

  // Hinge
  { id: 'romanian-deadlift', name: 'Romanian deadlift', type: 'compound', equipment: 'barbell', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['back'] },
  { id: 'db-romanian-deadlift', name: 'Dumbbell Romanian deadlift', type: 'compound', equipment: 'dumbbell', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['back'] },
  { id: 'back-extension', name: '45° back extension', type: 'isolation', equipment: 'bodyweight', loading: 'bodyweight-plus', pattern: 'hinge', primary: ['hamstrings', 'glutes'] },

  // Lunge / single leg
  { id: 'walking-lunge', name: 'Walking lunge', type: 'compound', equipment: 'dumbbell', pattern: 'lunge', primary: ['quads', 'glutes'], perSide: true },
  { id: 'reverse-lunge', name: 'Reverse lunge', type: 'compound', equipment: 'dumbbell', pattern: 'lunge', primary: ['quads', 'glutes'], perSide: true },
  { id: 'step-up', name: 'Dumbbell step-up', type: 'compound', equipment: 'dumbbell', pattern: 'lunge', primary: ['quads', 'glutes'], perSide: true },
  { id: 'bulgarian-split-squat', name: 'Bulgarian split squat', type: 'compound', equipment: 'dumbbell', pattern: 'lunge', primary: ['quads', 'glutes'], perSide: true },

  // Knee flexion
  { id: 'lying-leg-curl', name: 'Lying leg curl', type: 'isolation', equipment: 'machine', pattern: 'knee-flexion', primary: ['hamstrings'] },
  { id: 'seated-leg-curl', name: 'Seated leg curl', type: 'isolation', equipment: 'machine', pattern: 'knee-flexion', primary: ['hamstrings'] },

  // Calves
  { id: 'standing-calf-raise', name: 'Standing calf raise', type: 'isolation', equipment: 'machine', pattern: 'calf', primary: ['calves'] },
  { id: 'seated-calf-raise', name: 'Seated calf raise', type: 'isolation', equipment: 'machine', pattern: 'calf', primary: ['calves'] },
  { id: 'leg-press-calf-raise', name: 'Leg press calf raise', type: 'isolation', equipment: 'machine', pattern: 'calf', primary: ['calves'], incrementLb: 5 },

  // Lateral raise
  { id: 'cable-lateral-raise', name: 'Cable lateral raise', type: 'isolation', equipment: 'cable', pattern: 'lateral-raise', primary: ['side-delts'] },
  { id: 'db-lateral-raise', name: 'Dumbbell lateral raise', type: 'isolation', equipment: 'dumbbell', pattern: 'lateral-raise', primary: ['side-delts'] },
  { id: 'machine-lateral-raise', name: 'Machine lateral raise', type: 'isolation', equipment: 'machine', pattern: 'lateral-raise', primary: ['side-delts'] },

  // Chest fly
  { id: 'low-to-high-cable-fly', name: 'Low-to-high cable fly', type: 'isolation', equipment: 'cable', pattern: 'chest-fly', primary: ['chest'], secondary: ['front-delts'] },
  { id: 'pec-deck', name: 'Pec deck', type: 'isolation', equipment: 'machine', pattern: 'chest-fly', primary: ['chest'] },
  { id: 'db-fly', name: 'Dumbbell fly', type: 'isolation', equipment: 'dumbbell', pattern: 'chest-fly', primary: ['chest'] },

  // Triceps
  { id: 'overhead-triceps-extension', name: 'Overhead cable triceps extension', type: 'isolation', equipment: 'cable', pattern: 'triceps', primary: ['triceps'] },
  { id: 'triceps-pushdown', name: 'Triceps pushdown', type: 'isolation', equipment: 'cable', pattern: 'triceps', primary: ['triceps'] },
  { id: 'ez-skull-crusher', name: 'EZ-bar skull crusher', type: 'isolation', equipment: 'barbell', pattern: 'triceps', primary: ['triceps'] },
  { id: 'db-overhead-extension', name: 'Dumbbell overhead extension', type: 'isolation', equipment: 'dumbbell', pattern: 'triceps', primary: ['triceps'] },

  // Rear delt
  { id: 'face-pull', name: 'Face pull', type: 'isolation', equipment: 'cable', pattern: 'rear-delt', primary: ['rear-delts'], secondary: ['back'] },
  { id: 'reverse-pec-deck', name: 'Reverse pec deck', type: 'isolation', equipment: 'machine', pattern: 'rear-delt', primary: ['rear-delts'] },
  { id: 'db-reverse-fly', name: 'Dumbbell reverse fly', type: 'isolation', equipment: 'dumbbell', pattern: 'rear-delt', primary: ['rear-delts'] },

  // Biceps
  { id: 'incline-db-curl', name: 'Incline dumbbell curl', type: 'isolation', equipment: 'dumbbell', pattern: 'biceps', primary: ['biceps'] },
  { id: 'hammer-curl', name: 'Hammer curl', type: 'isolation', equipment: 'dumbbell', pattern: 'biceps', primary: ['biceps'] },
  { id: 'cable-curl', name: 'Cable curl', type: 'isolation', equipment: 'cable', pattern: 'biceps', primary: ['biceps'] },
  { id: 'ez-bar-curl', name: 'EZ-bar curl', type: 'isolation', equipment: 'barbell', pattern: 'biceps', primary: ['biceps'] },

  // Hip extension
  { id: 'hip-thrust', name: 'Barbell hip thrust', type: 'compound', equipment: 'barbell', pattern: 'hip-extension', primary: ['glutes'], secondary: ['hamstrings'] },
  { id: 'machine-hip-thrust', name: 'Machine hip thrust', type: 'compound', equipment: 'machine', pattern: 'hip-extension', primary: ['glutes'], secondary: ['hamstrings'] },
  { id: 'cable-pull-through', name: 'Cable pull-through', type: 'isolation', equipment: 'cable', pattern: 'hip-extension', primary: ['glutes'], secondary: ['hamstrings'] },

  // Core
  { id: 'cable-crunch', name: 'Cable crunch', type: 'isolation', equipment: 'cable', pattern: 'core', primary: ['core'] },
  { id: 'hanging-leg-raise', name: 'Hanging leg raise', type: 'isolation', equipment: 'bodyweight', loading: 'bodyweight-plus', pattern: 'core', primary: ['core'], incrementLb: 0 },
  { id: 'captains-chair-raise', name: "Captain's chair knee raise", type: 'isolation', equipment: 'bodyweight', loading: 'bodyweight-plus', pattern: 'core', primary: ['core'], incrementLb: 0 },
  { id: 'ab-wheel', name: 'Ab wheel rollout', type: 'isolation', equipment: 'bodyweight', loading: 'bodyweight-plus', pattern: 'core', primary: ['core'], incrementLb: 0 },
  { id: 'decline-crunch', name: 'Weighted decline crunch', type: 'isolation', equipment: 'dumbbell', pattern: 'core', primary: ['core'] },
  { id: 'plank', name: 'Plank', type: 'timed', equipment: 'bodyweight', pattern: 'core', primary: ['core'], timedProgression: 'add-weight', incrementLb: 10 },
  { id: 'rkc-plank', name: 'RKC plank', type: 'timed', equipment: 'bodyweight', pattern: 'core', primary: ['core'], timedProgression: 'harder-variation', incrementLb: 0 },
  { id: 'side-plank', name: 'Side plank', type: 'timed', equipment: 'bodyweight', pattern: 'core', primary: ['core'], perSide: true, timedProgression: 'add-weight', incrementLb: 5 },

  // Conditioning
  { id: 'bike-intervals', name: 'Bike intervals (30s hard / 60s easy)', type: 'cardio', equipment: 'cardio', pattern: 'conditioning', primary: [] },
  { id: 'incline-treadmill-intervals', name: 'Incline treadmill intervals (30s hard / 60s easy)', type: 'cardio', equipment: 'cardio', pattern: 'conditioning', primary: [] },
  { id: 'rower-intervals', name: 'Rower intervals (30s hard / 60s easy)', type: 'cardio', equipment: 'cardio', pattern: 'conditioning', primary: [] },
]

/** Alternates default to every other exercise with the same movement pattern. */
function withAlternates(list: Exercise[]): Exercise[] {
  return list.map((e) => ({
    ...e,
    alternates: list.filter((o) => o.id !== e.id && o.pattern === e.pattern).map((o) => o.id),
  }))
}

export const EXERCISE_LIBRARY: readonly Exercise[] = withAlternates(defs.map(ex))

/** Library description for an exercise, used when a stored copy predates descriptions. */
export function describe(e: Pick<Exercise, 'id' | 'description'>): string | undefined {
  return e.description ?? EXERCISE_DESCRIPTIONS[e.id]
}

export function exerciseMap(list: readonly Exercise[]): Map<string, Exercise> {
  return new Map(list.map((e) => [e.id, e]))
}
