import type { Caution, EquipmentItem, Exercise, ExerciseSlot, Profile, Schedule, SessionTemplate, Weekday } from '../types'

/**
 * Builds a starting program from a profile: a split for the number of days,
 * and for each slot the first exercise (in a sensible order of preference)
 * that the equipment allows and the user's limitations don't flag.
 */

type Role = 'main' | 'accessory' | 'core' | 'finisher'
interface SlotSpec {
  role: Role
  /** Candidate exercise ids, most preferred first. */
  pick: string[]
}

const H_PRESS = ['incline-barbell-press', 'incline-db-press', 'flat-db-press', 'machine-chest-press', 'incline-smith-press', 'flat-barbell-bench', 'push-up']
const H_PRESS_B = ['flat-db-press', 'machine-chest-press', 'incline-db-press', 'flat-barbell-bench', 'push-up']
const V_PULL = ['weighted-pull-up', 'lat-pulldown', 'neutral-grip-pulldown', 'chin-up', 'inverted-row']
const V_PULL_B = ['neutral-grip-pulldown', 'lat-pulldown', 'chin-up', 'weighted-pull-up', 'inverted-row']
const V_PRESS = ['seated-db-ohp', 'machine-shoulder-press', 'standing-barbell-ohp', 'pike-push-up', 'machine-lateral-raise', 'db-lateral-raise', 'cable-lateral-raise']
const H_PULL = ['chest-supported-row', 'incline-db-row', 'seated-cable-row', 'one-arm-db-row', 'barbell-row', 'inverted-row']
const H_PULL_B = ['incline-db-row', 'seated-cable-row', 'chest-supported-row', 'one-arm-db-row', 'barbell-row', 'inverted-row']
const SQUAT = ['back-squat', 'hack-squat', 'leg-press', 'front-squat', 'pendulum-squat', 'bodyweight-squat']
const SQUAT_B = ['leg-press', 'hack-squat', 'pendulum-squat', 'back-squat', 'bodyweight-squat']
const HINGE = ['romanian-deadlift', 'db-romanian-deadlift', 'hip-thrust', 'machine-hip-thrust', 'cable-pull-through', 'glute-bridge']
const GLUTE = ['hip-thrust', 'machine-hip-thrust', 'cable-pull-through', 'glute-bridge']
const LUNGE = ['walking-lunge', 'reverse-lunge', 'bulgarian-split-squat', 'step-up', 'glute-bridge']
const LUNGE_B = ['bulgarian-split-squat', 'reverse-lunge', 'walking-lunge', 'step-up', 'glute-bridge']
const LEG_CURL = ['lying-leg-curl', 'seated-leg-curl', 'cable-pull-through', 'glute-bridge']
const CALF = ['standing-calf-raise', 'leg-press-calf-raise', 'seated-calf-raise']
const LATERAL = ['cable-lateral-raise', 'db-lateral-raise', 'machine-lateral-raise']
const FLY = ['low-to-high-cable-fly', 'pec-deck', 'db-fly', 'push-up']
const TRI = ['overhead-triceps-extension', 'db-overhead-extension', 'triceps-pushdown', 'ez-skull-crusher', 'push-up']
const TRI_B = ['triceps-pushdown', 'ez-skull-crusher', 'overhead-triceps-extension', 'db-overhead-extension']
const REAR = ['face-pull', 'reverse-pec-deck', 'db-reverse-fly']
const CURL = ['incline-db-curl', 'cable-curl', 'ez-bar-curl']
const CURL_B = ['hammer-curl', 'cable-curl', 'ez-bar-curl']
const CORE = ['cable-crunch', 'side-plank', 'dead-bug', 'plank']
const CORE_B = ['hanging-leg-raise', 'captains-chair-raise', 'dead-bug', 'plank']
const CORE_C = ['plank', 'dead-bug', 'side-plank', 'bird-dog']
const CORE_D = ['ab-wheel', 'dead-bug', 'bird-dog', 'plank']
const FINISH = ['bike-intervals', 'incline-treadmill-intervals', 'rower-intervals', 'burpee-intervals']

const m = (pick: string[]): SlotSpec => ({ role: 'main', pick })
const a = (pick: string[]): SlotSpec => ({ role: 'accessory', pick })
const c = (pick: string[]): SlotSpec => ({ role: 'core', pick })

const SESSION_SPECS: Record<string, { name: string; short: string; slots: SlotSpec[] }> = {
  upper: { name: 'Upper', short: 'Upper', slots: [m(H_PRESS), m(V_PULL), m(V_PRESS), m(H_PULL), a(LATERAL), a(CURL), c(CORE)] },
  lower: { name: 'Lower', short: 'Lower', slots: [m(SQUAT), m(HINGE), a(LUNGE), a(LEG_CURL), a(CALF), c(CORE_B)] },
  'upper-b': { name: 'Upper B', short: 'Upper B', slots: [m(H_PRESS_B), m(H_PULL_B), m(V_PULL_B), a(LATERAL), a(TRI_B), a(REAR), c(CORE_C)] },
  'lower-b': { name: 'Lower B', short: 'Lower B', slots: [m(SQUAT_B), m(GLUTE), a(LUNGE_B), a(LEG_CURL), a(CALF), c(CORE_D)] },
  push: { name: 'Push', short: 'Push', slots: [m(H_PRESS_B), a(LATERAL), a(FLY), a(TRI), a(TRI_B), c(CORE_C)] },
  pull: { name: 'Pull', short: 'Pull', slots: [m(H_PULL_B), a(V_PULL_B), a(REAR), a(CURL), a(CURL_B), c(CORE_D)] },
  legs: { name: 'Legs + conditioning', short: 'Legs', slots: [m(SQUAT_B), a(LEG_CURL), a(GLUTE), a(CALF), { role: 'finisher', pick: FINISH }] },
  'full-a': { name: 'Full body A', short: 'Full A', slots: [m(SQUAT), m(H_PRESS), m(H_PULL), a(LEG_CURL), a(LATERAL), c(CORE)] },
  'full-b': { name: 'Full body B', short: 'Full B', slots: [m(HINGE), m(V_PULL), m(V_PRESS), a(LUNGE), a(TRI), c(CORE_B)] },
  'full-c': { name: 'Full body C', short: 'Full C', slots: [m(SQUAT_B), m(H_PRESS_B), m(H_PULL_B), a(GLUTE), a(CURL), c(CORE_C)] },
}

/** Which sessions, on which weekdays (0 = Sunday), for each number of training days. */
const SPLITS: Record<number, { day: Weekday; session: string }[]> = {
  2: [
    { day: 1, session: 'full-a' },
    { day: 4, session: 'full-b' },
  ],
  3: [
    { day: 1, session: 'full-a' },
    { day: 3, session: 'full-b' },
    { day: 5, session: 'full-c' },
  ],
  4: [
    { day: 1, session: 'upper' },
    { day: 2, session: 'lower' },
    { day: 4, session: 'upper-b' },
    { day: 5, session: 'lower-b' },
  ],
  5: [
    { day: 1, session: 'upper' },
    { day: 2, session: 'lower' },
    { day: 4, session: 'push' },
    { day: 5, session: 'pull' },
    { day: 6, session: 'legs' },
  ],
  6: [
    { day: 1, session: 'push' },
    { day: 2, session: 'pull' },
    { day: 3, session: 'legs' },
    { day: 4, session: 'upper-b' },
    { day: 5, session: 'lower-b' },
    { day: 6, session: 'upper' },
  ],
}

/** Equipment an exercise needs, beyond its broad equipment type. */
const NEEDS: Record<string, EquipmentItem[]> = {
  'weighted-pull-up': ['pullup-bar'],
  'chin-up': ['pullup-bar'],
  'hanging-leg-raise': ['pullup-bar'],
  'inverted-row': ['pullup-bar'],
  'captains-chair-raise': ['machines'],
  'back-extension': ['machines'],
  'incline-barbell-press': ['bench'],
  'flat-barbell-bench': ['bench'],
  'incline-db-press': ['bench'],
  'flat-db-press': ['bench'],
  'incline-db-row': ['bench'],
  'incline-db-curl': ['bench'],
  'seated-db-ohp': ['bench'],
  'hip-thrust': ['bench'],
  'bulgarian-split-squat': ['bench'],
  'one-arm-db-row': ['bench'],
  'db-fly': ['bench'],
  'ez-skull-crusher': ['bench'],
}

export function allowed(e: Exercise, equipment: readonly EquipmentItem[], limitations: readonly Caution[]): boolean {
  const has = (x: EquipmentItem) => equipment.includes(x)
  const broad = { barbell: 'barbell', dumbbell: 'dumbbells', machine: 'machines', cable: 'cables', cardio: 'cardio' } as const
  if (e.equipment !== 'bodyweight' && !has(broad[e.equipment])) return false
  if ((NEEDS[e.id] ?? []).some((x) => !has(x))) return false
  if ((e.cautions ?? []).some((cz) => limitations.includes(cz))) return false
  return true
}

/** Sets and rep range for a slot, from the goal and experience. */
function prescription(role: Role, e: Exercise, p: Pick<Profile, 'goal' | 'experience'>): Pick<ExerciseSlot, 'sets' | 'repMin' | 'repMax'> {
  if (role === 'finisher') return { sets: 1, repMin: 10, repMax: 10 }
  if (e.type === 'timed') return { sets: 3, repMin: 20, repMax: 45 }
  const bw = e.loading === 'bodyweight-plus' && e.incrementLb <= 0
  let sets = role === 'main' ? 4 : 3
  let [lo, hi] = role === 'main' ? (p.goal === 'strength' ? [4, 6] : [6, 10]) : [10, 15]
  if (role === 'core') [lo, hi] = [10, 15]
  if (bw && role !== 'core') [lo, hi] = [8, 20]
  if (p.goal === 'health') [lo, hi] = [Math.max(lo, 8), Math.max(hi, 12)]
  if (p.experience === 'new') {
    sets = Math.max(2, sets - 1)
    if (role === 'main' && !bw) [lo, hi] = [8, 12]
  }
  return { sets, repMin: lo, repMax: hi }
}

export interface GeneratedProgram {
  sessions: SessionTemplate[]
  schedule: Schedule
}

export function generateProgram(p: Profile, library: Map<string, Exercise>): GeneratedProgram {
  const days = Math.min(6, Math.max(2, Math.round(p.daysPerWeek)))
  const maxSlots = p.sessionMinutes <= 30 ? 4 : p.sessionMinutes <= 45 ? 5 : p.sessionMinutes <= 60 ? 6 : 7
  const usedInProgram = new Set<string>()
  const sessions: SessionTemplate[] = []
  const split = SPLITS[days] ?? SPLITS[3]!

  for (const { session } of split) {
    const spec = SESSION_SPECS[session]
    if (!spec) continue
    const usedHere = new Set<string>()
    const slots: ExerciseSlot[] = []
    // Keep the finisher even when time is short; trim accessories first.
    const specSlots = spec.slots.filter((s) => s.role !== 'finisher').slice(0, maxSlots - (spec.slots.some((s) => s.role === 'finisher') ? 1 : 0))
    const finisher = spec.slots.find((s) => s.role === 'finisher')
    for (const s of finisher ? [...specSlots, finisher] : specSlots) {
      const ok = s.pick.map((id) => library.get(id)).filter((e): e is Exercise => !!e && allowed(e, p.equipment, p.limitations) && !usedHere.has(e.id))
      const e = ok.find((x) => !usedInProgram.has(x.id)) ?? ok[0]
      if (!e) continue
      usedHere.add(e.id)
      usedInProgram.add(e.id)
      slots.push({ slotId: `${session}-${slots.length + 1}`, exerciseId: e.id, ...prescription(s.role, e, p), isMainLift: s.role === 'main' && e.type === 'compound' })
    }
    sessions.push({ id: session, name: spec.name, short: spec.short, slots })
  }

  const schedule = {} as Schedule
  const trainingDays = new Set(split.map((x) => x.day))
  for (const d of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    const s = split.find((x) => x.day === d)
    if (s) schedule[d] = { kind: 'session', sessionId: s.session }
    else if (d === 0) schedule[d] = { kind: 'walk' }
    else if (!trainingDays.has(d) && (p.goal === 'lose-fat' || p.goal === 'health' || p.goal === 'recomp') && days <= 5 && d === 3) schedule[d] = { kind: 'zone2', minutes: 30 }
    else schedule[d] = { kind: 'rest' }
  }
  return { sessions, schedule }
}
