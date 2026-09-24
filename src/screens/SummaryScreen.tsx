import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router'
import { Badge, Card, Loading, Screen, SectionTitle } from '../components/ui'
import { weekDefinition } from '../data/program'
import { db } from '../db/db'
import { useExercises, useSessions, useSettings } from '../db/repo'
import { findPRs, workoutVolume, exerciseHistory } from '../lib/history'
import { suggest } from '../lib/progression'
import { displayWeight, formatNumber, weightUnit } from '../lib/units'

export function SummaryScreen() {
  const { id } = useParams()
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const bodyweight = useLiveQuery(async () => (await db.dailyLogs.orderBy('date').reverse().filter((d) => d.weightLb !== undefined).first())?.weightLb, [])

  if (!settings || !sessions || !exercises || !workouts) return <Loading />
  const workout = workouts.find((w) => w.id === id)
  if (!workout) {
    return (
      <Screen title="Not found" back="/">
        <p className="text-muted">That workout isn't saved.</p>
      </Screen>
    )
  }
  const u = settings.units
  const fmtW = (lb: number) => `${formatNumber(displayWeight(lb, u))} ${weightUnit(u)}`
  const session = sessions.find((s) => s.id === workout.sessionTemplateId)
  const minutes = workout.finishedAt ? Math.round((workout.finishedAt - workout.startedAt) / 60_000) : 0
  const volume = workoutVolume(workout.sets, exercises)
  const working = workout.sets.filter((s) => !s.isWarmup).length
  const earlier = workouts.filter((w) => w.id !== workout.id && (w.date < workout.date || (w.date === workout.date && w.startedAt < workout.startedAt)))
  const prs = findPRs(workout, earlier, exercises, bodyweight)

  // "Next time": run progression with this workout included in history.
  const nextWeek = weekDefinition(workout.weekNumber + 1)
  const exerciseIds = [...new Set(workout.sets.filter((s) => !s.isWarmup).map((s) => s.exerciseId))]
  const next = exerciseIds.flatMap((exId) => {
    const e = exercises.get(exId)
    const slot = session?.slots.find((s) => s.slotId === workout.sets.find((x) => x.exerciseId === exId)?.slotId)
    if (!e || !slot || e.type === 'cardio') return []
    const history = exerciseHistory(workouts, exId)
    const s = suggest({ exercise: e, repMin: slot.repMin, repMax: slot.repMax, sets: slot.sets, phase: nextWeek.phase, todayRir: nextWeek.targetRir, history, formatWeight: fmtW })
    return [{ name: e.name, reason: s.reason, flag: s.flag }]
  })

  return (
    <Screen title="Done" subtitle={`${session?.name ?? 'Workout'} · week ${workout.weekNumber}`}>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Minutes', String(minutes)],
          ['Sets', String(working)],
          [`Volume ${weightUnit(u)}`, formatNumber(Math.round(displayWeight(volume, u)))],
        ].map(([label, value]) => (
          <Card key={label} className="p-3 text-center">
            <div className="num text-4xl leading-none font-bold">{value}</div>
            <div className="mt-1 text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{label}</div>
          </Card>
        ))}
      </div>

      <SectionTitle>Personal records</SectionTitle>
      <Card>
        {prs.length === 0 ? (
          <p className="text-sm text-muted">
            {earlier.length === 0 ? 'First session logged. This is your baseline; records start next time.' : 'No new records this time.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {prs.map((p) => (
              <li key={`${p.exerciseId}-${p.kind}`} className="flex items-center gap-2">
                <Badge tone="accent">{p.kind === 'e1rm' ? 'e1RM' : 'Weight'}</Badge>
                <span className="flex-1">{exercises.get(p.exerciseId)?.name}</span>
                <span className="num text-xl">{fmtW(p.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionTitle>Next time</SectionTitle>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {next.map((n) => (
            <li key={n.name} className="px-4 py-3">
              <p className="font-semibold">{n.name}</p>
              <p className={`text-sm ${n.flag ? 'text-warn' : 'text-muted'}`}>{n.reason}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Link to="/" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-accent font-bold text-accent-ink">
        Back to Today
      </Link>
    </Screen>
  )
}
