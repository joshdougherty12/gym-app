import { useState } from 'react'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { Button, Card, Loading, Screen, SectionTitle, Segmented, Stepper, Toggle } from '../components/ui'
import { downloadBackup } from '../db/backup'
import { resetAllData, resetProgram, saveExercise, updateSettings, useExercises, useSessions, useSettings } from '../db/repo'
import { programWeek } from '../lib/calendar'
import { newId } from '../lib/id'
import { isIsoDate, mondayOf, nextMonday, shortDate, todayIso } from '../lib/dates'
import { displayWeight, inputWeightToLb, roundTo, weightUnit } from '../lib/units'
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

export function SettingsScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const [shiftWeeks, setShiftWeeks] = useState(1)
  const [shiftFrom, setShiftFrom] = useState<'this' | 'next'>('this')
  // Equipment defaults changed during this visit; only those offer "apply to all".
  const [edited, setEdited] = useState<Set<Equipment>>(new Set())

  if (!settings || !sessions || !exercises) return <Loading />
  const set = (patch: Partial<Settings>) => void updateSettings(patch)
  const today = todayIso()
  const week = programWeek(today, settings.startDate, settings.pauses)
  const thisMonday = mondayOf(today)
  const shiftStart = shiftFrom === 'this' ? thisMonday : nextMonday(today)
  function addPause() {
    if (!settings) return
    set({ pauses: [...settings.pauses, { id: newId('pause'), start: shiftStart, weeks: shiftWeeks }] })
  }

  return (
    <Screen title="Settings" subtitle="Everything stays on this device.">
      <SectionTitle>Display</SectionTitle>
      <Card className="space-y-3">
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
      </Card>

      <SectionTitle>Targets</SectionTitle>
      <Card className="space-y-2">
        <Stepper label="Calories" suffix="kcal" value={settings.calorieTarget} step={25} min={1200} max={5000} onChange={(calorieTarget) => set({ calorieTarget })} />
        <Stepper label="Protein" suffix="g" value={settings.proteinTargetG} step={5} min={50} max={400} onChange={(proteinTargetG) => set({ proteinTargetG })} />
        <Stepper label="Steps" value={settings.stepGoal} step={500} min={1000} max={30000} onChange={(stepGoal) => set({ stepGoal })} />
        <WeightStepper label="Loss rate, min / week" lb={settings.lossRateMinLb} units={settings.units} stepLb={0.25} onChange={(lossRateMinLb) => set({ lossRateMinLb, lossRateMaxLb: Math.max(lossRateMinLb, settings.lossRateMaxLb) })} />
        <WeightStepper label="Loss rate, max / week" lb={settings.lossRateMaxLb} units={settings.units} stepLb={0.25} onChange={(lossRateMaxLb) => set({ lossRateMaxLb, lossRateMinLb: Math.min(lossRateMaxLb, settings.lossRateMinLb) })} />
      </Card>

      <SectionTitle>Rest timer</SectionTitle>
      <Card className="space-y-2">
        <Stepper label="Compound" suffix="s" value={settings.restCompoundSec} step={15} min={0} max={600} onChange={(restCompoundSec) => set({ restCompoundSec })} />
        <Stepper label="Isolation" suffix="s" value={settings.restIsolationSec} step={15} min={0} max={600} onChange={(restIsolationSec) => set({ restIsolationSec })} />
        <Stepper label="Timed (plank)" suffix="s" value={settings.restTimedSec} step={15} min={0} max={600} onChange={(restTimedSec) => set({ restTimedSec })} />
        <Toggle label="Sound when rest ends" checked={settings.timerSound} onChange={(timerSound) => set({ timerSound })} />
        <Toggle label="Vibrate when rest ends" checked={settings.timerVibrate} onChange={(timerVibrate) => set({ timerVibrate })} />
      </Card>

      <SectionTitle>Weight increments</SectionTitle>
      <Card className="space-y-3">
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
      </Card>

      <SectionTitle>Program</SectionTitle>
      <Card className="space-y-3">
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
      </Card>

      <SectionTitle>Weekly schedule</SectionTitle>
      <Card className="py-1">
        <ScheduleEditor schedule={settings.schedule} sessions={sessions} onChange={(schedule) => set({ schedule })} />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card className="space-y-2">
        <p className="text-sm text-muted">Stored only in this browser on this device. Nothing is ever uploaded.</p>
        <Button className="w-full" variant="primary" onClick={() => void downloadBackup()}>
          Download backup (JSON)
        </Button>
        <Button
          className="w-full"
          onClick={() => {
            if (window.confirm('Put every session and exercise back to the original program? Your logs are kept.')) void resetProgram()
          }}
        >
          Reset program to default
        </Button>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            const typed = window.prompt('This deletes ALL workouts, weigh-ins, photos and settings. Type RESET to confirm.')
            if (typed === 'RESET') void resetAllData().then(() => window.location.reload())
          }}
        >
          Reset all data
        </Button>
      </Card>
    </Screen>
  )
}
