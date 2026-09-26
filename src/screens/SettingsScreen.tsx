import { useState } from 'react'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { Section, useAccordion } from '../components/Accordion'
import { Button, Loading, Screen, Segmented, Stepper, Toggle } from '../components/ui'
import { DataSection } from '../components/DataSection'
import { ReminderFields } from '../components/ReminderFields'
import { Link } from 'react-router'
import { MealAiSettings } from '../components/MealAiSettings'
import { useHasApiKey } from '../db/meals'
import { saveExercise, updateSettings, useExercises, useSessions, useSettings } from '../db/repo'
import { programWeek } from '../lib/calendar'
import { newId } from '../lib/id'
import { isIsoDate, mondayOf, nextMonday, shortDate, todayIso } from '../lib/dates'
import { formatRest } from '../lib/rest'
import { displayWeight, formatNumber, inputWeightToLb, roundTo, weightUnit } from '../lib/units'
import type { Equipment, Settings, Units } from '../types'

const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: 'barbell', label: 'Barbell (total)' },
  { key: 'dumbbell', label: 'Dumbbell (each)' },
  { key: 'machine', label: 'Machine' },
  { key: 'cable', label: 'Cable' },
  { key: 'bodyweight', label: 'Added to bodyweight' },
]

/** A stepper that shows lb or kg but always stores lb. */
function WeightStepper({ label, lb, units, stepLb, onChange }: { label: string; lb: number; units: Units; stepLb: number; onChange: (lb: number) => void }) {
  const shown = units === 'metric' ? roundTo(displayWeight(lb, units), 0.05) : lb
  const step = units === 'metric' ? roundTo(stepLb / 2.2046226218, 0.05) : stepLb
  return (
    <Stepper
      label={label}
      value={shown}
      step={step}
      min={0}
      suffix={weightUnit(units)}
      onChange={(v) => onChange(roundTo(inputWeightToLb(v, units), 0.01))}
    />
  )
}

const GOAL_LABEL = { 'lose-fat': 'lose fat', 'build-muscle': 'build muscle', recomp: 'recomp', strength: 'strength', health: 'health' } as const

export function SettingsScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const [shiftWeeks, setShiftWeeks] = useState(1)
  const [shiftFrom, setShiftFrom] = useState<'this' | 'next'>('this')
  // Equipment defaults changed during this visit; only those offer "apply to all".
  const [edited, setEdited] = useState<Set<Equipment>>(new Set())
  const { open, toggle } = useAccordion()
  const hasKey = useHasApiKey()

  if (!settings || !sessions || !exercises) return <Loading />
  const set = (patch: Partial<Settings>) => void updateSettings(patch)
  const today = todayIso()
  const week = programWeek(today, settings.startDate, settings.pauses)
  const thisMonday = mondayOf(today)
  const shiftStart = shiftFrom === 'this' ? thisMonday : nextMonday(today)
  const u = settings.units
  const inc = (e: Equipment) => `+${formatNumber(roundTo(displayWeight(settings.incrementDefaults[e], u), 0.25))}`
  const summaries = {
    display: `${u === 'imperial' ? 'lb / in' : 'kg / cm'} · ${settings.theme} theme · ${settings.workoutView === 'single' ? 'one exercise at a time' : 'scroll list'}`,
    targets: `${settings.calorieTarget.toLocaleString()} kcal · ${settings.proteinTargetG} g protein · ${settings.stepGoal.toLocaleString()} steps`,
    mealai: hasKey ? 'Connected · Claude Sonnet 5' : 'Not connected: add your API key',
    rest: `${formatRest(settings.restCompoundSec)} compound · ${formatRest(settings.restIsolationSec)} isolation${settings.timerSound || settings.timerVibrate ? '' : ' · silent'}`,
    increments: `Barbell ${inc('barbell')} · Dumbbell ${inc('dumbbell')} · Machine ${inc('machine')} ${weightUnit(u)}`,
    program: `Started ${shortDate(settings.startDate)}${week === null ? '' : ` · week ${week}`}${settings.pauses.length ? ` · ${settings.pauses.length} shift${settings.pauses.length === 1 ? '' : 's'}` : ''}`,
    data: 'Backup, restore, demo, reset',
    profile: settings.profile ? `${settings.profile.age} · ${GOAL_LABEL[settings.profile.goal]} · ${settings.profile.daysPerWeek} days/week${settings.profile.limitations.length ? ' · easy on ' + settings.profile.limitations.join(', ') : ''}` : 'Not set up yet',
    reminders: [settings.reminders.workout ? `training days ${settings.reminders.workoutTime}` : '', settings.reminders.missed ? `nudge ${settings.reminders.missedTime}` : '', settings.reminders.weighIn ? `weigh-in ${settings.reminders.weighInTime}` : ''].filter(Boolean).join(' · ') || 'Off',
  }
  function addPause() {
    if (!settings) return
    set({ pauses: [...settings.pauses, { id: newId('pause'), start: shiftStart, weeks: shiftWeeks }] })
  }

  return (
    <Screen title="Settings" subtitle="Everything stays on this device.">
      {settings.week12Decision?.choice === 'surplus' && (
        <p className="mb-2 rounded-xl bg-surface-2 p-3 text-sm">Goal: small surplus (chosen at week 12). The weekly review now aims for +0.25-0.5 lb/week.</p>
      )}

      <div className="space-y-2">
      <Section id="profile" title="Profile" summary={summaries.profile} open={open === 'profile'} onToggle={toggle}>
        <div className="space-y-2">
          {settings.profile ? (
            <p className="text-sm text-muted">
              {settings.profile.sex === 'unspecified' ? '' : settings.profile.sex === 'male' ? 'Male · ' : 'Female · '}
              {settings.profile.age} years · {Math.floor(settings.profile.heightIn / 12)}'{Math.round(settings.profile.heightIn % 12)}" · {Math.round(settings.profile.weightLb)} lb at setup · {settings.profile.experience} lifter ·{' '}
              {settings.profile.sessionMinutes} min sessions{settings.profile.limitationNotes ? ` · ${settings.profile.limitationNotes}` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted">Tell Cutline about you so targets, the program and meal ideas fit.</p>
          )}
          <Link to="/welcome?existing=1" className="flex min-h-11 items-center justify-center rounded-xl bg-accent font-bold text-accent-ink">
            {settings.profile ? 'Edit profile' : 'Set up profile'}
          </Link>
          <p className="text-xs text-muted">Editing asks before changing your targets or program.</p>
        </div>
      </Section>

      <Section id="reminders" title="Reminders" summary={summaries.reminders} open={open === 'reminders'} onToggle={toggle}>
        <ReminderFields value={settings.reminders} onChange={(reminders) => set({ reminders })} />
      </Section>

      <Section id="display" title="Display" summary={summaries.display} open={open === 'display'} onToggle={toggle}>
        <div className="space-y-3">
        <Segmented
          label="Units"
          value={settings.units}
          onChange={(units) => set({ units })}
          options={[
            { value: 'imperial', label: 'lb / in' },
            { value: 'metric', label: 'kg / cm' },
          ]}
        />
        <Segmented
          label="Theme"
          value={settings.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
        />
        <div>
          <p className="mb-1 text-sm font-medium">Workout screen</p>
          <Segmented
            label="Workout screen layout"
            value={settings.workoutView}
            onChange={(workoutView) => set({ workoutView })}
            options={[
              { value: 'single', label: 'One exercise' },
              { value: 'list', label: 'Scroll list' },
            ]}
          />
        </div>
        </div>
      </Section>

      <Section id="targets" title="Targets" summary={summaries.targets} open={open === 'targets'} onToggle={toggle}>
        <div className="space-y-2">
        <Stepper label="Calories" suffix="kcal" value={settings.calorieTarget} step={25} min={1200} max={5000} onChange={(calorieTarget) => set({ calorieTarget })} />
        <Stepper label="Protein" suffix="g" value={settings.proteinTargetG} step={5} min={50} max={400} onChange={(proteinTargetG) => set({ proteinTargetG })} />
        <Stepper label="Steps" value={settings.stepGoal} step={500} min={1000} max={30000} onChange={(stepGoal) => set({ stepGoal })} />
        <WeightStepper label="Loss rate, min / week" lb={settings.lossRateMinLb} units={settings.units} stepLb={0.25} onChange={(lossRateMinLb) => set({ lossRateMinLb, lossRateMaxLb: Math.max(lossRateMinLb, settings.lossRateMaxLb) })} />
        <WeightStepper label="Loss rate, max / week" lb={settings.lossRateMaxLb} units={settings.units} stepLb={0.25} onChange={(lossRateMaxLb) => set({ lossRateMaxLb, lossRateMinLb: Math.min(lossRateMaxLb, settings.lossRateMinLb) })} />
        </div>
      </Section>

      <Section id="mealai" title="Meal AI" summary={summaries.mealai} open={open === 'mealai'} onToggle={toggle}>
        <MealAiSettings settings={settings} />
      </Section>

      <Section id="rest" title="Rest timer" summary={summaries.rest} open={open === 'rest'} onToggle={toggle}>
        <div className="space-y-2">
        <Stepper label="Compound" suffix="s" value={settings.restCompoundSec} step={15} min={0} max={600} onChange={(restCompoundSec) => set({ restCompoundSec })} />
        <Stepper label="Isolation" suffix="s" value={settings.restIsolationSec} step={15} min={0} max={600} onChange={(restIsolationSec) => set({ restIsolationSec })} />
        <Stepper label="Timed (plank)" suffix="s" value={settings.restTimedSec} step={15} min={0} max={600} onChange={(restTimedSec) => set({ restTimedSec })} />
        <Toggle label="Sound when rest ends" checked={settings.timerSound} onChange={(timerSound) => set({ timerSound })} />
        <Toggle label="Vibrate when rest ends" checked={settings.timerVibrate} onChange={(timerVibrate) => set({ timerVibrate })} />
        </div>
      </Section>

      <Section id="increments" title="Weight increments" summary={summaries.increments} open={open === 'increments'} onToggle={toggle}>
        <div className="space-y-3">
        <p className="text-sm text-muted">
          Default jump per equipment type. Each exercise keeps its own increment (Program → session → exercise), e.g. plate-loaded
          leg press and hack squat move 5 lb. After changing a default you can copy it onto that equipment's exercises.
        </p>
        {EQUIPMENT.map(({ key, label }) => {
          const matching = [...exercises.values()].filter((e) => e.equipment === key)
          const value = settings.incrementDefaults[key]
          const differing = matching.filter((e) => e.incrementLb !== value && !(key === 'bodyweight' && e.incrementLb === 0))
          return (
            <div key={key} className="space-y-1">
              <WeightStepper
                label={label}
                lb={value}
                units={settings.units}
                stepLb={2.5}
                onChange={(v) => {
                  setEdited((s) => new Set(s).add(key))
                  set({ incrementDefaults: { ...settings.incrementDefaults, [key]: v } })
                }}
              />
              {edited.has(key) && differing.length > 0 && (
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    if (!window.confirm(`Set the increment of ${differing.length} ${key} exercise(s) to ${value} lb?`)) return
                    void Promise.all(differing.map((e) => saveExercise({ ...e, incrementLb: value })))
                  }}
                >
                  Apply to {differing.length} {key} exercise{differing.length === 1 ? '' : 's'} that differ
                </Button>
              )}
            </div>
          )
        })}
        </div>
      </Section>

      <Section id="program" title="Program & schedule" summary={summaries.program} open={open === 'program'} onToggle={toggle}>
        <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="start-date" className="flex-1 text-sm font-medium">
            Start date <span className="block text-xs text-muted">{week === null ? 'Not started yet' : `Today is week ${week}`}</span>
          </label>
          <input
            id="start-date"
            type="date"
            value={settings.startDate}
            onChange={(e) => {
              if (isIsoDate(e.target.value)) set({ startDate: e.target.value })
            }}
            className="min-h-11 rounded-xl border border-line bg-surface-2 px-3"
          />
        </div>

        <div className="border-t border-line pt-3">
          <p className="text-sm font-medium">Shift the program (illness, travel)</p>
          <p className="mb-2 text-xs text-muted">
            Takes whole weeks off. The program holds at the week it was in and picks up there afterwards. History is kept.
          </p>
          <Stepper label="Weeks off" value={shiftWeeks} min={1} max={8} onChange={setShiftWeeks} />
          <div className="mt-2">
            <Segmented
              label="Shift starts"
              value={shiftFrom}
              onChange={setShiftFrom}
              options={[
                { value: 'this', label: `This week (${shortDate(thisMonday)})` },
                { value: 'next', label: `Next week (${shortDate(nextMonday(today))})` },
              ]}
            />
          </div>
          <Button
            className="mt-2 w-full"
            onClick={addPause}
          >
            Take {shiftWeeks} week{shiftWeeks === 1 ? '' : 's'} off from {shortDate(shiftStart)}
          </Button>
          {settings.pauses.length > 0 && (
            <ul className="mt-2 divide-y divide-line">
              {settings.pauses.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1">
                    {p.weeks} week{p.weeks === 1 ? '' : 's'} off from {shortDate(p.start)}
                  </span>
                  <Button variant="ghost" onClick={() => set({ pauses: settings.pauses.filter((x) => x.id !== p.id) })}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="text-sm font-medium">Weekly schedule</p>
          <ScheduleEditor schedule={settings.schedule} sessions={sessions} onChange={(schedule) => set({ schedule })} />
        </div>
      </Section>

      <Section id="data" title="Data" summary={summaries.data} open={open === 'data'} onToggle={toggle}>
        <DataSection />
      </Section>
      </div>
    </Screen>
  )
}
