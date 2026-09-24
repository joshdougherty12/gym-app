import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ExercisePicker } from '../components/ExercisePicker'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, Loading, Screen, Sheet, Stepper, Toggle } from '../components/ui'
import { weekDefinition } from '../data/program'
import { saveExercise, saveSession, saveWeekOverride, useExercises, useSessions, useSettings, useWeekOverride } from '../db/repo'
import { programWeek } from '../lib/calendar'
import { todayIso } from '../lib/dates'
import { newId } from '../lib/id'
import { formatRest, restFor } from '../lib/rest'
import { formatNumber } from '../lib/units'
import { formatRir, formatSlotTarget, plannedSets, targetRirForSet } from '../lib/weekPlan'
import type { Exercise, ExerciseSlot, SessionTemplate, WeekOverride } from '../types'

function newSlot(e: Exercise): ExerciseSlot {
  const slotId = newId('slot')
  const [repMin, repMax, sets] =
    e.type === 'compound' ? [8, 10, 3] : e.type === 'timed' ? [30, 45, 3] : e.type === 'cardio' ? [10, 10, 1] : [10, 12, 3]
  return { slotId, exerciseId: e.id, sets, repMin, repMax, isMainLift: false }
}

export function SessionScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const [editing, setEditing] = useState<string | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [adding, setAdding] = useState(false)

  const fallbackWeek = settings ? (programWeek(todayIso(), settings.startDate, settings.pauses) ?? 0) : 0
  const weekParam = params.get('week')
  const week = weekParam !== null && Number.isInteger(Number(weekParam)) ? Number(weekParam) : fallbackWeek
  const override = useWeekOverride(week)

  if (!settings || !sessions || !exercises) return <Loading />
  const session = sessions.find((s) => s.id === id)
  if (!session) {
    return (
      <Screen title="Not found" back="/program">
        <p className="text-muted">That session doesn't exist.</p>
      </Screen>
    )
  }

  const def = weekDefinition(week)
  const slot = session.slots.find((s) => s.slotId === editing)
  const slotEx = slot ? exercises.get(slot.exerciseId) : undefined

  const update = (next: SessionTemplate) => void saveSession(next)
  const updateSlot = (slotId: string, patch: Partial<ExerciseSlot>) =>
    update({ ...session, slots: session.slots.map((s) => (s.slotId === slotId ? { ...s, ...patch } : s)) })
  const move = (slotId: string, dir: -1 | 1) => {
    const i = session.slots.findIndex((s) => s.slotId === slotId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= session.slots.length) return
    const slots = [...session.slots]
    const a = slots[i]
    const b = slots[j]
    if (!a || !b) return
    slots[i] = b
    slots[j] = a
    update({ ...session, slots })
  }
  const weekOverride: WeekOverride = override ?? { weekNumber: week, extraSets: {} }
  const setWeekExtra = (slotId: string, extra: number) =>
    void saveWeekOverride({ ...weekOverride, extraSets: { ...weekOverride.extraSets, [slotId]: extra } })

  return (
    <Screen title={session.short} subtitle={`${session.name} · week ${week} · ${formatRir(def.targetRir)}`} back={`/program?week=${week}`}>
      <ol className="space-y-2">
        {session.slots.map((s, i) => {
          const e = exercises.get(s.exerciseId)
          if (!e) {
            return (
              <li key={s.slotId}>
                <Card>
                  <p className="text-bad">Missing exercise “{s.exerciseId}”.</p>
                </Card>
              </li>
            )
          }
          const plan = plannedSets(s, e, def, override)
          const lastRir = targetRirForSet(def, s, plan.sets - 1, plan.sets)
          return (
            <li key={s.slotId}>
              <button
                type="button"
                onClick={() => setEditing(s.slotId)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
              >
                <span className="num w-6 text-2xl font-bold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{e.name}</span>
                  <span className="num block text-2xl leading-tight">{formatSlotTarget(s, e, plan.sets)}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {s.isMainLift && <Badge tone="accent">Main lift</Badge>}
                    {e.type !== 'cardio' && <Badge>Rest {formatRest(restFor(s, e, settings))}</Badge>}
                    {e.incrementLb > 0 && <Badge>+{formatNumber(e.incrementLb)} lb</Badge>}
                    {s.isMainLift && def.mainLiftLastSetRir && <Badge tone="warn">Last set {formatRir(lastRir)}</Badge>}
                    {plan.reasons.map((r) => (
                      <Badge key={r} tone="good">
                        {r}
                      </Badge>
                    ))}
                  </span>
                  {s.note && <span className="mt-1 block text-sm text-muted">{s.note}</span>}
                </span>
                <Icon name="chevronRight" className="size-5 shrink-0 text-muted" />
              </button>
            </li>
          )
        })}
      </ol>

      <Button className="mt-3 w-full" onClick={() => setAdding(true)}>
        <span className="inline-flex items-center gap-2">
          <Icon name="plus" className="size-5" /> Add exercise
        </span>
      </Button>

      {/* Slot editor */}
      <Sheet
        open={!!slot && !swapping}
        onClose={() => setEditing(null)}
        title={slotEx?.name ?? 'Exercise'}
      >
        {slot && slotEx && (
          <div className="space-y-4">
            <Button className="w-full" onClick={() => setSwapping(true)}>
              <span className="inline-flex items-center gap-2">
                <Icon name="swap" className="size-5" /> Swap exercise
              </span>
            </Button>

            <div className="space-y-2">
              <h3 className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Every week</h3>
              <Stepper label="Sets" value={slot.sets} min={1} max={10} onChange={(v) => updateSlot(slot.slotId, { sets: v })} />
              <Stepper
                label={slotEx.type === 'timed' ? 'Min seconds' : slotEx.type === 'cardio' ? 'Min minutes' : 'Min reps'}
                value={slot.repMin}
                min={1}
                step={slotEx.type === 'timed' ? 5 : 1}
                onChange={(v) => updateSlot(slot.slotId, { repMin: v, repMax: Math.max(v, slot.repMax) })}
              />
              <Stepper
                label={slotEx.type === 'timed' ? 'Max seconds' : slotEx.type === 'cardio' ? 'Max minutes' : 'Max reps'}
                value={slot.repMax}
                min={1}
                step={slotEx.type === 'timed' ? 5 : 1}
                onChange={(v) => updateSlot(slot.slotId, { repMax: v, repMin: Math.min(v, slot.repMin) })}
              />
              {slotEx.type !== 'cardio' && (
                <>
                  <Stepper
                    label="Rest"
                    suffix="s"
                    value={restFor(slot, slotEx, settings)}
                    step={15}
                    min={0}
                    max={600}
                    onChange={(v) => updateSlot(slot.slotId, { restSec: v })}
                  />
                  <Toggle
                    label="Main lift"
                    hint="Peak weeks take its last set to 0-1 RIR; tracked for strength drops."
                    checked={slot.isMainLift}
                    onChange={(v) => updateSlot(slot.slotId, { isMainLift: v })}
                  />
                </>
              )}
            </div>

            {slotEx.type !== 'cardio' && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Exercise (all sessions)</h3>
                <Stepper
                  label={slotEx.equipment === 'dumbbell' ? 'Increment (per dumbbell)' : 'Weight increment'}
                  suffix="lb"
                  value={slotEx.incrementLb}
                  step={2.5}
                  min={0}
                  max={50}
                  onChange={(v) => void saveExercise({ ...slotEx, incrementLb: v })}
                />
                <Toggle
                  label="Log each side separately"
                  checked={slotEx.perSide}
                  onChange={(v) => void saveExercise({ ...slotEx, perSide: v })}
                />
                {slotEx.type === 'timed' && (
                  <Toggle
                    label="At the top of the range, add weight"
                    hint="Off: move to a harder variation instead."
                    checked={slotEx.timedProgression !== 'harder-variation'}
                    onChange={(v) => void saveExercise({ ...slotEx, timedProgression: v ? 'add-weight' : 'harder-variation' })}
                  />
                )}
              </div>
            )}

            {slotEx.type !== 'cardio' && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Week {week} only</h3>
                <Stepper
                  label="Extra sets"
                  value={weekOverride.extraSets[slot.slotId] ?? 0}
                  min={-9}
                  max={5}
                  onChange={(v) => setWeekExtra(slot.slotId, v)}
                />
              </div>
            )}

            <div>
              <label htmlFor="slot-note" className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
                Note
              </label>
              <input
                id="slot-note"
                defaultValue={slot.note ?? ''}
                onBlur={(e) => updateSlot(slot.slotId, { note: e.target.value || undefined })}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3"
              />
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => move(slot.slotId, -1)}>
                Move up
              </Button>
              <Button className="flex-1" onClick={() => move(slot.slotId, 1)}>
                Move down
              </Button>
            </div>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                if (!window.confirm(`Remove ${slotEx.name} from ${session.name}?`)) return
                update({ ...session, slots: session.slots.filter((s) => s.slotId !== slot.slotId) })
                setEditing(null)
              }}
            >
              Remove from session
            </Button>
          </div>
        )}
      </Sheet>

      {/* Swap */}
      <Sheet open={swapping} onClose={() => setSwapping(false)} title="Swap exercise">
        {slot && slotEx && (
          <ExercisePicker
            exercises={exercises}
            alternates={slotEx.alternates}
            excludeId={slotEx.id}
            onPick={(e) => {
              updateSlot(slot.slotId, { exerciseId: e.id })
              setSwapping(false)
            }}
          />
        )}
      </Sheet>

      {/* Add */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add exercise">
        <ExercisePicker
          exercises={exercises}
          onPick={(e) => {
            const s = newSlot(e)
            update({ ...session, slots: [...session.slots, s] })
            setAdding(false)
            setEditing(s.slotId)
          }}
        />
      </Sheet>
    </Screen>
  )
}
