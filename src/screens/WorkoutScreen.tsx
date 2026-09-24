import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { BigStepper } from '../components/BigStepper'
import { ExercisePicker } from '../components/ExercisePicker'
import { Icon } from '../components/Icon'
import { RestTimerBar } from '../components/RestTimerBar'
import { Badge, Button, Loading, Sheet } from '../components/ui'
import { effectiveWeek } from '../data/program'
import { db } from '../db/db'
import { useExercises, useSessions, useSettings, useWeekOverride } from '../db/repo'
import { useWakeLock } from '../hooks/useWakeLock'
import { primeAudio } from '../lib/alarm'
import { formatRest, restFor } from '../lib/rest'
import { displayWeight, formatNumber, inputWeightToLb, weightUnit } from '../lib/units'
import { formatRir } from '../lib/weekPlan'
import { bestSetInWeek, defaultDraft, findLogged, planWorkout, rowKey, type SlotPlan } from '../lib/workoutPlan'
import { useActiveWorkout } from '../store/activeWorkout'
import { useRestTimer } from '../store/restTimer'
import type { DraftSet, SetLog, Settings } from '../types'

function useElapsed(since: number): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  const min = Math.max(0, Math.floor((now - since) / 60_000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`
}

export function WorkoutScreen() {
  const { active, loaded, load, update, finish, discard } = useActiveWorkout()
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const weekOverride = useWeekOverride(active?.workout.weekNumber ?? -1)
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [swapSlot, setSwapSlot] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const startTimer = useRestTimer((s) => s.start)
  const skipTimer = useRestTimer((s) => s.skip)
  const timerRunning = useRestTimer((s) => s.endsAt !== null)
  useWakeLock(true)

  useEffect(() => {
    void load()
  }, [load])

  const units = settings?.units ?? 'imperial'
  const fmtW = (lb: number) => `${formatNumber(displayWeight(lb, units))} ${weightUnit(units)}`
  const session = sessions?.find((s) => s.id === active?.workout.sessionTemplateId)
  const week = effectiveWeek(active?.workout.weekNumber ?? 0, active?.workout.deload)

  const plans = useMemo(() => {
    if (!active || !session || !exercises || !workouts) return null
    return planWorkout({
      session,
      exercises,
      week,
      ...(weekOverride ? { weekOverride } : {}),
      slotOverrides: active.slotOverrides,
      workouts,
      activeWorkoutId: active.workout.id,
      formatWeight: fmtW,
    })
    // fmtW only depends on units
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, session, exercises, workouts, week, weekOverride, units])

  const elapsed = useElapsed(active?.workout.startedAt ?? Date.now())

  if (!loaded || !settings || !sessions || !exercises) return <Loading />
  if (!active) return <Navigate to="/" replace />
  if (!session || !plans) return <Loading />

  const sets = active.workout.sets
  const current = plans[Math.min(index, plans.length - 1)]
  const doneCount = (p: SlotPlan) => sets.filter((s) => s.slotId === p.slot.slotId && s.exerciseId === p.exercise.id && !s.isWarmup).length
  const remaining = plans.reduce((n, p) => n + Math.max(0, p.workingSets - doneCount(p)), 0)

  const logSet = (p: SlotPlan, warmup: boolean, i: number, d: DraftSet) => {
    primeAudio()
    const reps = d.repsLeft !== undefined && d.repsRight !== undefined ? Math.min(d.repsLeft, d.repsRight) : d.reps
    const entry: SetLog = {
      slotId: p.slot.slotId,
      exerciseId: p.exercise.id,
      setIndex: i,
      weightLb: d.weightLb,
      reps,
      rir: d.rir,
      isWarmup: warmup,
      loggedAt: Date.now(),
      ...(d.repsLeft !== undefined ? { repsLeft: d.repsLeft } : {}),
      ...(d.repsRight !== undefined ? { repsRight: d.repsRight } : {}),
      ...(d.durationSec !== undefined ? { durationSec: d.durationSec } : {}),
    }
    const key = rowKey(p.slot.slotId, p.exercise.id, warmup, i)
    update((a) => {
      const { [key]: _drop, ...drafts } = a.drafts
      const others = a.workout.sets.filter((s) => !(s.slotId === entry.slotId && s.exerciseId === entry.exerciseId && s.isWarmup === warmup && s.setIndex === i))
      return { ...a, drafts, workout: { ...a.workout, sets: [...others, entry] } }
    })
    if (p.exercise.type !== 'cardio') {
      const rest = warmup ? Math.min(60, restFor(p.slot, p.exercise, settings)) : restFor(p.slot, p.exercise, settings)
      if (rest > 0) startTimer(rest, p.exercise.name)
    }
  }

  const unlog = (p: SlotPlan, s: SetLog) => {
    const key = rowKey(p.slot.slotId, p.exercise.id, s.isWarmup, s.setIndex)
    update((a) => ({
      ...a,
      drafts: {
        ...a.drafts,
        [key]: {
          weightLb: s.weightLb,
          reps: s.reps,
          rir: s.rir,
          ...(s.repsLeft !== undefined ? { repsLeft: s.repsLeft } : {}),
          ...(s.repsRight !== undefined ? { repsRight: s.repsRight } : {}),
          ...(s.durationSec !== undefined ? { durationSec: s.durationSec } : {}),
        },
      },
      workout: { ...a.workout, sets: a.workout.sets.filter((x) => x !== s && !(x.loggedAt === s.loggedAt && x.slotId === s.slotId && x.setIndex === s.setIndex && x.isWarmup === s.isWarmup)) },
    }))
  }

  const setDraft = (key: string, d: DraftSet) => update((a) => ({ ...a, drafts: { ...a.drafts, [key]: d } }))

  const changeSets = (p: SlotPlan, delta: number) =>
    update((a) => {
      const o = a.slotOverrides[p.slot.slotId] ?? {}
      return { ...a, slotOverrides: { ...a.slotOverrides, [p.slot.slotId]: { ...o, setDelta: (o.setDelta ?? 0) + delta } } }
    })
  const changeWarmups = (p: SlotPlan, delta: number) =>
    update((a) => {
      const o = a.slotOverrides[p.slot.slotId] ?? {}
      return { ...a, slotOverrides: { ...a.slotOverrides, [p.slot.slotId]: { ...o, warmups: Math.max(0, (o.warmups ?? 0) + delta) } } }
    })

  const onFinish = async () => {
    if (remaining > 0 && !window.confirm(`${remaining} planned set${remaining === 1 ? '' : 's'} not logged. Finish anyway?`)) return
    skipTimer()
    const log = await finish()
    if (log) navigate(`/workout/summary/${log.id}`, { replace: true })
  }

  const renderSlot = (p: SlotPlan) => (
    <SlotCard
      key={p.slot.slotId}
      plan={p}
      sets={sets}
      drafts={active.drafts}
      settings={settings}
      week8Best={week.phase === 'peak' && p.slot.isMainLift ? bestSetInWeek(workouts ?? [], p.exercise.id, 8) : undefined}
      fmtW={fmtW}
      note={active.workout.exerciseNotes?.[p.slot.slotId] ?? ''}
      onNote={(note) => update((a) => ({ ...a, workout: { ...a.workout, exerciseNotes: { ...a.workout.exerciseNotes, [p.slot.slotId]: note } } }))}
      onDraft={setDraft}
      onLog={logSet}
      onUnlog={unlog}
      onSwap={() => setSwapSlot(p.slot.slotId)}
      onAddSet={() => changeSets(p, 1)}
      onRemoveSet={() => changeSets(p, -1)}
      onAddWarmup={() => changeWarmups(p, 1)}
      onRemoveWarmup={() => changeWarmups(p, -1)}
    />
  )

  const swapPlan = plans.find((p) => p.slot.slotId === swapSlot)

  return (
    <div className={`mx-auto max-w-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] ${timerRunning ? 'pb-40' : 'pb-16'}`}>
      <header className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="num truncate text-3xl leading-none font-bold uppercase">{session.short}</h1>
          <p className="text-sm text-muted">
            Wk {active.workout.weekNumber} · {formatRir(week.targetRir)} · {elapsed}
          </p>
        </div>
        <button type="button" aria-label="Workout menu" onClick={() => setMenu(true)} className="grid size-11 place-items-center rounded-full text-muted">
          <span className="text-2xl leading-none">⋯</span>
        </button>
        <Button variant="primary" onClick={() => void onFinish()}>
          Finish
        </Button>
      </header>

      {settings.workoutView === 'single' ? (
        <>
          <nav aria-label="Exercises" className="-mx-4 mb-3 overflow-x-auto px-4">
            <ol className="flex gap-1.5">
              {plans.map((p, i) => {
                const done = doneCount(p) >= p.workingSets
                return (
                  <li key={p.slot.slotId}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={i === index ? 'step' : undefined}
                      aria-label={`${p.exercise.name}${done ? ', done' : ''}`}
                      className={`grid h-11 min-w-11 place-items-center rounded-xl border px-2 ${
                        i === index ? 'border-accent bg-accent-soft text-accent' : done ? 'border-good/40 bg-good/10 text-good' : 'border-line bg-surface text-muted'
                      }`}
                    >
                      {done ? <Icon name="check" className="size-5" /> : <span className="num text-xl font-bold">{i + 1}</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
          {current && renderSlot(current)}
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              ← Previous
            </Button>
            {index < plans.length - 1 ? (
              <Button className="flex-1" variant={current && doneCount(current) >= current.workingSets ? 'primary' : 'secondary'} onClick={() => setIndex((i) => Math.min(plans.length - 1, i + 1))}>
                Next →
              </Button>
            ) : (
              <Button className="flex-1" variant="primary" onClick={() => void onFinish()}>
                Finish workout
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {plans.map(renderSlot)}
          <Button className="w-full" variant="primary" onClick={() => void onFinish()}>
            Finish workout
          </Button>
        </div>
      )}

      <RestTimerBar sound={settings.timerSound} vibration={settings.timerVibrate} />

      <Sheet open={!!swapPlan} onClose={() => setSwapSlot(null)} title="Swap for today">
        {swapPlan && (
          <ExercisePicker
            exercises={exercises}
            alternates={swapPlan.exercise.alternates}
            excludeId={swapPlan.exercise.id}
            onPick={(e) => {
              update((a) => ({
                ...a,
                slotOverrides: { ...a.slotOverrides, [swapPlan.slot.slotId]: { ...a.slotOverrides[swapPlan.slot.slotId], exerciseId: e.id } },
              }))
              setSwapSlot(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Workout">
        <div className="space-y-2">
          <p className="text-sm text-muted">Everything is saved as you go. You can close the app and come back.</p>
          <Button
            className="w-full"
            onClick={() => {
              setMenu(false)
              navigate('/')
            }}
          >
            Back to Today (keep workout open)
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (!window.confirm('Discard this workout? Logged sets will be deleted.')) return
              skipTimer()
              void discard().then(() => navigate('/', { replace: true }))
            }}
          >
            Discard workout
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function SlotCard({
  plan,
  sets,
  drafts,
  settings,
  week8Best,
  fmtW,
  note,
  onNote,
  onDraft,
  onLog,
  onUnlog,
  onSwap,
  onAddSet,
  onRemoveSet,
  onAddWarmup,
  onRemoveWarmup,
}: {
  plan: SlotPlan
  sets: SetLog[]
  drafts: Record<string, DraftSet>
  settings: Settings
  week8Best: SetLog | undefined
  fmtW: (lb: number) => string
  note: string
  onNote: (n: string) => void
  onDraft: (key: string, d: DraftSet) => void
  onLog: (p: SlotPlan, warmup: boolean, i: number, d: DraftSet) => void
  onUnlog: (p: SlotPlan, s: SetLog) => void
  onSwap: () => void
  onAddSet: () => void
  onRemoveSet: () => void
  onAddWarmup: () => void
  onRemoveWarmup: () => void
}) {
  const { exercise: e, slot, suggestion, history, workingSets, warmups } = plan
  const last = history[0]
  const [noteOpen, setNoteOpen] = useState(note !== '')
  const timed = e.type === 'timed'
  const cardio = e.type === 'cardio'
  const loggedWorking = sets.filter((s) => s.slotId === slot.slotId && s.exerciseId === e.id && !s.isWarmup)
  // The row that is expanded by default: the first unlogged working set.
  const firstOpen = Array.from({ length: workingSets }, (_, i) => i).find((i) => !findLogged(sets, slot.slotId, e.id, false, i))
  const [expanded, setExpanded] = useState<string | null>(null)
  const openKey = expanded ?? (firstOpen !== undefined ? rowKey(slot.slotId, e.id, false, firstOpen) : null)
  const lastSets = last?.sets ?? []
  const unitLabel = timed ? 's' : ''

  const rows: { warmup: boolean; i: number }[] = [
    ...Array.from({ length: warmups }, (_, i) => ({ warmup: true, i })),
    ...Array.from({ length: workingSets }, (_, i) => ({ warmup: false, i })),
  ]

  return (
    <article className="rounded-2xl border border-line bg-surface p-4" aria-label={e.name}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold">{e.name}</h2>
          <p className="num text-xl text-muted">
            {cardio ? `${slot.repMin} min` : `${workingSets} × ${slot.repMin === slot.repMax ? slot.repMin : `${slot.repMin}-${slot.repMax}`}${unitLabel}${e.perSide ? ' / side' : ''}`}
            {!cardio && ` · rest ${formatRest(restFor(slot, e, settings))}`}
          </p>
        </div>
        <button type="button" onClick={onSwap} aria-label={`Swap ${e.name}`} className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
          <Icon name="swap" className="size-5" />
        </button>
      </div>

      {!cardio && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Last time{last ? ` · ${last.date.slice(5).replace('-', '/')}` : ''}</p>
          <p className="num text-xl">
            {last ? lastSets.map((s) => (timed ? `${s.durationSec ?? s.reps}s${s.weightLb ? ` +${formatNumber(displayWeight(s.weightLb, settings.units))}` : ''}` : `${formatNumber(displayWeight(s.weightLb, settings.units))}×${s.reps}`)).join('  ') : '—'}
          </p>
          {week8Best && (
            <p className="num text-lg text-warn">
              Week 8 best: {formatNumber(displayWeight(week8Best.weightLb, settings.units))}×{week8Best.reps}. Beat it.
            </p>
          )}
          <p className={`mt-1 ${suggestion.flag === 'missed-bottom-twice' || suggestion.flag === 'rir-too-low' ? 'text-warn' : 'text-ink'}`}>
            {suggestion.flag === 'missed-bottom-twice' && <Badge tone="warn">Flag</Badge>} {suggestion.reason}
          </p>
          {plan.setReasons.length > 0 && <p className="mt-1 text-xs text-good">{plan.setReasons.join(' · ')}</p>}
        </div>
      )}

      <ol className="mt-3 space-y-2">
        {rows.map(({ warmup, i }) => {
          const key = rowKey(slot.slotId, e.id, warmup, i)
          const logged = findLogged(sets, slot.slotId, e.id, warmup, i)
          const target = suggestion.sets[Math.min(i, suggestion.sets.length - 1)]
          const rir = plan.targetRir[i] ?? plan.targetRir[0]
          const label = warmup ? `Warm-up ${i + 1}` : cardio ? 'Session' : `Set ${i + 1}`
          if (logged) {
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onUnlog(plan, logged)}
                  aria-label={`${label} logged. Tap to edit.`}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${warmup ? 'bg-surface-2 text-muted' : 'bg-good/10'}`}
                >
                  <Icon name="check" className={`size-5 ${warmup ? '' : 'text-good'}`} />
                  <span className="w-20 text-xs font-bold tracking-wide uppercase">{label}</span>
                  <span className="num flex-1 text-2xl">
                    {cardio
                      ? `${Math.round((logged.durationSec ?? 0) / 60)} min`
                      : timed
                        ? `${logged.durationSec ?? 0}s${logged.weightLb ? ` +${fmtW(logged.weightLb)}` : ''}`
                        : `${formatNumber(displayWeight(logged.weightLb, settings.units))} × ${logged.repsLeft !== undefined ? `${logged.repsLeft}/${logged.repsRight}` : logged.reps}`}
                    {!cardio && !warmup && <span className="text-base text-muted"> @{logged.rir}</span>}
                  </span>
                  <span className="text-xs text-muted">edit</span>
                </button>
              </li>
            )
          }
          const d = drafts[key] ?? defaultDraft(plan, sets, warmup, i)
          const isOpen = openKey === key
          if (!isOpen) {
            return (
              <li key={key}>
                <button type="button" onClick={() => setExpanded(key)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 text-left text-muted">
                  <span className="w-5" />
                  <span className="w-20 text-xs font-bold tracking-wide uppercase">{label}</span>
                  <span className="num flex-1 text-xl">
                    {cardio ? `${slot.repMin} min` : timed ? `${d.durationSec ?? target?.reps ?? slot.repMin}s` : `${formatNumber(displayWeight(d.weightLb, settings.units))} × ${d.reps}`}
                  </span>
                  {!warmup && !cardio && rir && <span className="text-xs">{formatRir(rir)}</span>}
                </button>
              </li>
            )
          }
          const set = (patch: Partial<DraftSet>) => onDraft(key, { ...d, ...patch })
          const wStep = displayWeight(e.incrementLb > 0 ? e.incrementLb : 2.5, settings.units) || 1
          return (
            <li key={key} className={`rounded-2xl border-2 p-3 ${warmup ? 'border-line' : 'border-accent'}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-bold tracking-wide uppercase">{label}</span>
                {!warmup && !cardio && rir && <span className={`text-sm font-bold ${rir.max <= 1 ? 'text-warn' : 'text-accent'}`}>Target {formatRir(rir)}</span>}
                {warmup && <span className="text-xs text-muted">doesn't count</span>}
              </div>
              <div className="flex gap-2">
                {cardio ? (
                  <BigStepper label="minutes" value={Math.round((d.durationSec ?? 0) / 60)} step={1} min={0} max={180} onChange={(v) => set({ durationSec: v * 60 })} />
                ) : (
                  <>
                    {(!timed || e.timedProgression === 'add-weight') && (
                      <BigStepper
                        label={timed || e.loading === 'bodyweight-plus' ? `+${weightUnit(settings.units)}` : weightUnit(settings.units)}
                        value={displayWeight(d.weightLb, settings.units)}
                        step={wStep}
                        decimals
                        onChange={(v) => set({ weightLb: inputWeightToLb(v, settings.units) })}
                      />
                    )}
                    {timed ? (
                      <BigStepper label="seconds" value={d.durationSec ?? 0} step={5} max={600} onChange={(v) => set({ durationSec: v })} />
                    ) : e.perSide ? (
                      <>
                        <BigStepper label="left" value={d.repsLeft ?? d.reps} step={1} max={100} onChange={(v) => set({ repsLeft: v, reps: Math.min(v, d.repsRight ?? v) })} />
                        <BigStepper label="right" value={d.repsRight ?? d.reps} step={1} max={100} onChange={(v) => set({ repsRight: v, reps: Math.min(v, d.repsLeft ?? v) })} />
                      </>
                    ) : (
                      <BigStepper label="reps" value={d.reps} step={1} max={100} onChange={(v) => set({ reps: v })} />
                    )}
                    {!warmup && <BigStepper label="RIR" value={d.rir} step={1} max={10} onChange={(v) => set({ rir: v })} />}
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  onLog(plan, warmup, i, d)
                  setExpanded(null)
                }}
                className="mt-3 min-h-14 w-full rounded-xl bg-accent text-lg font-bold tracking-wide text-accent-ink uppercase active:scale-[0.99]"
              >
                Log {warmup ? 'warm-up' : cardio ? 'session' : 'set'}
              </button>
            </li>
          )
        })}
      </ol>

      {!cardio && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Button onClick={onAddSet}>+ Set</Button>
          <Button onClick={onRemoveSet} disabled={workingSets <= Math.max(1, loggedWorking.length)}>
            − Set
          </Button>
          <Button onClick={onAddWarmup}>+ Warm-up</Button>
          {warmups > 0 ? (
            <Button onClick={onRemoveWarmup} disabled={sets.some((s) => s.slotId === slot.slotId && s.isWarmup && s.setIndex === warmups - 1)}>
              − Warm-up
            </Button>
          ) : (
            <Button onClick={() => setNoteOpen((v) => !v)}>Note</Button>
          )}
        </div>
      )}
      {(noteOpen || warmups > 0 || cardio) && (
        <div className="mt-2">
          <label htmlFor={`note-${slot.slotId}`} className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
            Note
          </label>
          <input
            id={`note-${slot.slotId}`}
            defaultValue={note}
            onBlur={(ev) => onNote(ev.target.value)}
            placeholder="Seat height, grip, how it felt…"
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3"
          />
        </div>
      )}
    </article>
  )
}
