import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Choice, Chips, NumberField } from '../components/ProfileFields'
import { ReminderFields } from '../components/ReminderFields'
import { Badge, Button, Card, Loading, Segmented, Toggle } from '../components/ui'
import { db } from '../db/db'
import { DEFAULT_REMINDERS } from '../db/defaults'
import { applyProfile, libraryMap } from '../db/profile'
import { useSettings } from '../db/repo'
import { todayIso } from '../lib/dates'
import { timestamp } from '../lib/id'
import { generateProgram } from '../lib/programGen'
import { targetsFor } from '../lib/targets'
import { CM_PER_IN, inputWeightToLb, lbToKg } from '../lib/units'
import type { Settings, Budget, Caution, DietStyle, EquipmentItem, Exercise, Experience, Goal, Pace, Profile, ReminderSettings, Sex, Units } from '../types'

type Draft = Partial<Profile>

const EQUIP_PRESETS: { value: string; label: string; hint: string; items: EquipmentItem[] }[] = [
  { value: 'gym', label: 'Full gym', hint: 'Commercial gym', items: ['barbell', 'dumbbells', 'cables', 'machines', 'pullup-bar', 'bench', 'cardio'] },
  { value: 'home', label: 'Home gym', hint: 'Barbell, rack, dumbbells, bench', items: ['barbell', 'dumbbells', 'pullup-bar', 'bench'] },
  { value: 'dumbbells', label: 'Dumbbells', hint: 'Dumbbells and a bench', items: ['dumbbells', 'bench'] },
  { value: 'none', label: 'No equipment', hint: 'Bodyweight at home', items: [] },
]

const EQUIP_ITEMS: { value: EquipmentItem; label: string }[] = [
  { value: 'barbell', label: 'Barbell & plates' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bench', label: 'Bench' },
  { value: 'cables', label: 'Cable machine' },
  { value: 'machines', label: 'Weight machines' },
  { value: 'pullup-bar', label: 'Pull-up bar' },
  { value: 'cardio', label: 'Bike / treadmill / rower' },
]

const ALLERGIES = ['Dairy', 'Gluten', 'Peanuts', 'Tree nuts', 'Eggs', 'Shellfish', 'Fish', 'Soy'].map((x) => ({ value: x, label: x }))

const STEPS = ['About you', 'Goal', 'Training', 'Watch-outs', 'Food', 'Reminders', 'Your plan'] as const

function valid(step: number, d: Draft): boolean {
  if (step === 0) return !!d.sex && !!d.age && d.age >= 13 && d.age <= 100 && !!d.heightIn && d.heightIn >= 48 && d.heightIn <= 90 && !!d.weightLb && d.weightLb >= 70 && d.weightLb <= 700
  if (step === 1) return !!d.goal && !!d.pace
  if (step === 2) return !!d.daysPerWeek && !!d.sessionMinutes && !!d.experience && !!d.equipment
  return true
}

/** Loads what setup needs once, then hands a snapshot to the flow (so later saves never reset the answers). */
export function WelcomeScreen() {
  const settings = useSettings()
  const [params] = useSearchParams()
  const lib = useLiveQuery(() => libraryMap(), [])
  const workoutCount = useLiveQuery(() => db.workouts.count(), [])
  const [snapshot, setSnapshot] = useState<Settings | null>(null)
  if (!snapshot && settings) setSnapshot(settings)
  if (!snapshot || !lib || workoutCount === undefined) return <Loading />
  // Existing users keep their program and targets unless they opt in.
  const existing = workoutCount > 0 || params.get('existing') === '1'
  return <WelcomeFlow settings={snapshot} lib={lib} existing={existing} />
}

function initialDraft(s: Settings, existing: boolean): Draft {
  if (s.profile) return { ...s.profile }
  return {
    limitations: [],
    allergies: [],
    dietStyle: 'anything',
    budget: 'moderate',
    limitationNotes: '',
    // Carry an existing user's cholesterol note over; brand-new users start blank.
    healthNotes: existing && /cholesterol/i.test(s.foodNotes) ? 'High cholesterol' : '',
  }
}

function WelcomeFlow({ settings, lib, existing }: { settings: Settings; lib: Map<string, Exercise>; existing: boolean }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [units, setUnits] = useState<Units>(settings.units)
  const [d, setD] = useState<Draft>(() => initialDraft(settings, existing))
  const [reminders, setReminders] = useState<ReminderSettings>(settings.profile ? settings.reminders : { ...DEFAULT_REMINDERS, workout: true, missed: true })
  const [equipPreset, setEquipPreset] = useState<string | undefined>(undefined)
  const [updateTargets, setUpdateTargets] = useState(!existing)
  const [rebuild, setRebuild] = useState(!existing)
  const [busy, setBusy] = useState(false)

  const profile: Profile | null = useMemo(() => {
    if (![0, 1, 2].every((s) => valid(s, d))) return null
    return {
      ...(d.name ? { name: d.name } : {}),
      sex: d.sex as Sex,
      age: d.age as number,
      heightIn: d.heightIn as number,
      weightLb: d.weightLb as number,
      goal: d.goal as Goal,
      pace: d.pace as Pace,
      experience: d.experience as Experience,
      daysPerWeek: d.daysPerWeek as number,
      sessionMinutes: d.sessionMinutes as number,
      equipment: d.equipment as EquipmentItem[],
      limitations: d.limitations ?? [],
      limitationNotes: d.limitationNotes ?? '',
      dietStyle: d.dietStyle ?? 'anything',
      allergies: d.allergies ?? [],
      healthNotes: d.healthNotes ?? '',
      budget: d.budget ?? 'moderate',
      createdAt: settings?.profile?.createdAt ?? timestamp(),
    }
  }, [d, settings.profile?.createdAt])

  const set = (patch: Draft) => setD((x) => ({ ...x, ...patch }))
  const isLast = step === STEPS.length - 1

  const finish = async () => {
    if (!profile) return
    setBusy(true)
    await db.settings.update('app', { units })
    await applyProfile(profile, { updateTargets, rebuildProgram: rebuild, startToday: !existing, reminders }, todayIso())
    navigate('/', { replace: true })
  }

  // Height and weight in the chosen units.
  const ft = d.heightIn ? Math.floor(d.heightIn / 12) : undefined
  const inch = d.heightIn !== undefined && ft !== undefined ? Math.round(d.heightIn - ft * 12) : undefined
  const cm = d.heightIn ? Math.round(d.heightIn * CM_PER_IN) : undefined
  const shownWeight = d.weightLb === undefined ? undefined : units === 'metric' ? Math.round(lbToKg(d.weightLb) * 10) / 10 : Math.round(d.weightLb * 10) / 10

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1rem,var(--sat))] pb-[max(1rem,var(--sab))]">
      <header className="mb-4">
        <div className="flex gap-1" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-surface-2'}`} />
          ))}
        </div>
        <p className="mt-3 text-xs font-bold tracking-[0.14em] text-muted uppercase">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="num text-4xl leading-none font-bold uppercase">{step === 0 && !existing && !settings.profile ? 'Welcome to Cutline' : STEPS[step]}</h1>
        {step === 0 && <p className="mt-1 text-sm text-muted">A few questions so the program, targets and meal ideas fit you. About two minutes. Everything stays on this phone.</p>}
      </header>

      <div className="flex-1 space-y-5">
        {step === 0 && (
          <>
            <Segmented label="Units" value={units} onChange={setUnits} options={[{ value: 'imperial', label: 'lb / ft' }, { value: 'metric', label: 'kg / cm' }]} />
            <Choice<Sex> label="Sex (for calorie math)" value={d.sex} onChange={(sex) => set({ sex })} cols={3} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'unspecified', label: 'Prefer not' }]} />
            <NumberField label="Age" value={d.age} onChange={(age) => set({ age })} unit="years" min={13} max={100} />
            {units === 'imperial' ? (
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Height" value={ft} onChange={(v) => set({ heightIn: (v ?? 0) * 12 + (inch ?? 0) || undefined })} unit="ft" min={4} max={7} />
                <NumberField label={"\u00a0"} value={inch} onChange={(v) => set({ heightIn: (ft ?? 0) * 12 + (v ?? 0) || undefined })} unit="in" min={0} max={11} />
              </div>
            ) : (
              <NumberField label="Height" value={cm} onChange={(v) => set({ heightIn: v ? v / CM_PER_IN : undefined })} unit="cm" min={120} max={230} />
            )}
            <NumberField label="Weight" value={shownWeight} step={0.1} onChange={(v) => set({ weightLb: v === undefined ? undefined : inputWeightToLb(v, units) })} unit={units === 'metric' ? 'kg' : 'lb'} />
          </>
        )}

        {step === 1 && (
          <>
            <Choice<Goal>
              label="Main goal"
              value={d.goal}
              onChange={(goal) => set({ goal })}
              cols={1}
              options={[
                { value: 'lose-fat', label: 'Lose fat', hint: 'Get leaner while keeping strength' },
                { value: 'build-muscle', label: 'Build muscle', hint: 'Small calorie surplus, more size' },
                { value: 'recomp', label: 'Recomp', hint: 'Slowly lose fat and gain muscle' },
                { value: 'strength', label: 'Get stronger', hint: 'Heavier main lifts, lower reps' },
                { value: 'health', label: 'Health & fitness', hint: 'Feel better, move better' },
              ]}
            />
            <Choice<Pace>
              label="How fast?"
              value={d.pace}
              onChange={(pace) => set({ pace })}
              cols={3}
              options={[
                { value: 'gentle', label: 'Gentle', hint: 'Easiest to stick to' },
                { value: 'steady', label: 'Steady', hint: 'Recommended' },
                { value: 'aggressive', label: 'Faster', hint: 'Harder' },
              ]}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Choice<number> label="Days per week" value={d.daysPerWeek} onChange={(daysPerWeek) => set({ daysPerWeek })} cols={3} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n), hint: n === 2 || n === 3 ? 'Full body' : n === 4 ? 'Upper / lower' : n === 5 ? 'Upper / lower / PPL' : 'Push / pull / legs' }))} />
            <Choice<number> label="Time per workout" value={d.sessionMinutes} onChange={(sessionMinutes) => set({ sessionMinutes })} cols={2} options={[30, 45, 60, 75].map((n) => ({ value: n, label: `${n} min` }))} />
            <Choice<Experience>
              label="Lifting experience"
              value={d.experience}
              onChange={(experience) => set({ experience })}
              cols={3}
              options={[
                { value: 'new', label: 'New', hint: 'Under 6 months' },
                { value: 'some', label: 'Some', hint: '6 mo - 2 yr' },
                { value: 'experienced', label: 'Experienced', hint: '2+ years' },
              ]}
            />
            <Choice<string>
              label="Where do you train?"
              value={equipPreset}
              onChange={(v) => {
                setEquipPreset(v)
                set({ equipment: EQUIP_PRESETS.find((p) => p.value === v)?.items ?? [] })
              }}
              options={EQUIP_PRESETS.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
            />
            {d.equipment && <Chips<EquipmentItem> label="Fine-tune your equipment" values={d.equipment} options={EQUIP_ITEMS} onChange={(equipment) => set({ equipment })} />}
          </>
        )}

        {step === 3 && (
          <>
            <Chips<Caution>
              label="Anything to go easy on?"
              hint="The program avoids exercises that load these hard, and warns you before you swap one in."
              values={d.limitations ?? []}
              onChange={(limitations) => set({ limitations })}
              options={[
                { value: 'low-back', label: 'Low back' },
                { value: 'knees', label: 'Knees' },
                { value: 'shoulders', label: 'Shoulders' },
              ]}
            />
            <div>
              <label htmlFor="lim-notes" className="mb-1 block text-sm font-semibold">
                Injuries or notes <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea id="lim-notes" rows={3} value={d.limitationNotes ?? ''} onChange={(e) => set({ limitationNotes: e.target.value })} placeholder="e.g. patellar tendonitis in my right knee, old disc issue" className="w-full rounded-2xl border-2 border-line bg-surface p-3" />
            </div>
            <p className="text-xs text-muted">Cutline is not medical advice. If something hurts, stop and swap it, and follow your doctor or physical therapist.</p>
          </>
        )}

        {step === 4 && (
          <>
            <Choice<DietStyle>
              label="How do you eat?"
              value={d.dietStyle}
              onChange={(dietStyle) => set({ dietStyle })}
              cols={3}
              options={[
                { value: 'anything', label: 'Anything' },
                { value: 'vegetarian', label: 'Vegetarian' },
                { value: 'vegan', label: 'Vegan' },
                { value: 'pescatarian', label: 'Pescatarian' },
                { value: 'keto', label: 'Low carb' },
                { value: 'halal', label: 'Halal' },
              ]}
            />
            <Chips<string> label="Allergies or foods to avoid" values={d.allergies ?? []} onChange={(allergies) => set({ allergies })} options={ALLERGIES} />
            <div>
              <label htmlFor="health" className="mb-1 block text-sm font-semibold">
                Health notes for meals <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea id="health" rows={2} value={d.healthNotes ?? ''} onChange={(e) => set({ healthNotes: e.target.value })} placeholder="e.g. high cholesterol, high blood pressure, prediabetes" className="w-full rounded-2xl border-2 border-line bg-surface p-3" />
            </div>
            <Choice<Budget> label="Grocery budget" value={d.budget} onChange={(budget) => set({ budget })} cols={3} options={[{ value: 'tight', label: 'Tight' }, { value: 'moderate', label: 'Moderate' }, { value: 'flexible', label: 'Flexible' }]} />
          </>
        )}

        {step === 5 && (
          <Card>
            <p className="mb-3 text-sm text-muted">Optional nudges on the days that count. You can change these any time in Settings.</p>
            <ReminderFields value={reminders} onChange={setReminders} />
          </Card>
        )}

        {step === 6 && profile && <PlanSummary profile={profile} lib={lib} existing={existing} updateTargets={updateTargets} setUpdateTargets={setUpdateTargets} rebuild={rebuild} setRebuild={setRebuild} />}
      </div>

      <footer className="sticky bottom-0 mt-6 flex gap-2 bg-bg pt-2">
        {step > 0 ? (
          <Button className="min-h-14 flex-1" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : existing || settings.profile ? (
          <Button className="min-h-14 flex-1" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        ) : null}
        <Button variant="primary" className="min-h-14 flex-[2] text-lg" disabled={!valid(step, d) || busy || (isLast && !profile)} onClick={() => (isLast ? void finish() : setStep((s) => s + 1))}>
          {isLast ? (busy ? 'Setting up…' : existing ? 'Save profile' : 'Start my plan') : 'Next'}
        </Button>
      </footer>
    </div>
  )
}

function PlanSummary({ profile, lib, existing, updateTargets, setUpdateTargets, rebuild, setRebuild }: { profile: Profile; lib: Map<string, Exercise>; existing: boolean; updateTargets: boolean; setUpdateTargets: (v: boolean) => void; rebuild: boolean; setRebuild: (v: boolean) => void }) {
  const t = targetsFor(profile)
  const program = generateProgram(profile, lib)
  const names = (id: string) => lib.get(id)?.name ?? id
  return (
    <div className="space-y-3">
      <Card>
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Daily targets</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          {[
            [t.calorieTarget.toLocaleString(), 'kcal'],
            [`${t.proteinTargetG} g`, 'protein'],
            [`${t.fiberTargetG} g+`, 'fiber'],
            [`< ${t.satFatLimitG} g`, 'saturated fat'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-surface-2 p-2">
              <div className="num text-2xl font-bold">{v}</div>
              <div className="text-[11px] font-bold tracking-wide text-muted uppercase">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">A starting estimate. The weekly review adjusts calories from your real weigh-ins.</p>
        {existing && <Toggle label="Use these targets" hint="Off keeps your current targets." checked={updateTargets} onChange={setUpdateTargets} />}
      </Card>
      <Card>
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Your program · {program.sessions.length} days a week</p>
        <ul className="mt-2 space-y-2">
          {program.sessions.map((s) => (
            <li key={s.id}>
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm text-muted">{s.slots.map((x) => names(x.exerciseId)).join(' · ')}</p>
            </li>
          ))}
        </ul>
        {profile.limitations.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1">
            {profile.limitations.map((l) => (
              <Badge key={l} tone="good">
                Easy on {l === 'low-back' ? 'low back' : l}
              </Badge>
            ))}
          </p>
        )}
        {existing && <Toggle label="Replace my current program with this" hint="Off keeps your program and schedule. Your logged workouts are never touched." checked={rebuild} onChange={setRebuild} />}
      </Card>
    </div>
  )
}
