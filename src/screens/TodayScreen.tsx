import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckIn } from '../components/CheckIn'
import { Icon } from '../components/Icon'
import { PHASE_TEXT } from '../components/phase'
import { Badge, Button, Card, Loading, Screen, Sheet } from '../components/ui'
import { PHASES, weekDefinition } from '../data/program'
import { db } from '../db/db'
import { useExercises, useSessions, useSettings, useWeekOverride } from '../db/repo'
import { shortDate, todayIso, WEEKDAY_LONG, weekdayOf } from '../lib/dates'
import { dayInfo, planLabel } from '../lib/today'
import { formatRir, formatSlotTarget, plannedSets } from '../lib/weekPlan'
import { useActiveWorkout } from '../store/activeWorkout'

export function TodayScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const { active, loaded, load, startNew } = useActiveWorkout()
  const navigate = useNavigate()
  const [pickOther, setPickOther] = useState(false)
  const today = todayIso()
  const doneToday = useLiveQuery(() => db.workouts.where('date').equals(today).toArray(), [today])
  const info = settings ? dayInfo(today, settings) : null
  const weekOverride = useWeekOverride(info?.week ?? -1)

  useEffect(() => {
    void load()
  }, [load])

  if (!settings || !sessions || !exercises || !loaded || !info) return <Loading />

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? 'Unknown session'
  const plannedId = info.plan.kind === 'session' ? info.plan.sessionId : undefined
  const session = sessions.find((s) => s.id === plannedId)
  const week = info.week ?? 0
  const weekDef = weekDefinition(week)
  const finishedToday = (doneToday ?? []).filter((w) => w.finishedAt !== undefined)

  const begin = async (sessionId: string) => {
    await startNew(sessionId, today, week)
    navigate('/workout')
  }

  return (
    <Screen title={WEEKDAY_LONG[weekdayOf(today)]} subtitle={shortDate(today)}>
      {active && (
        <Link to="/workout" className="mb-3 flex min-h-16 items-center gap-3 rounded-2xl bg-accent px-4 text-accent-ink">
          <span className="flex-1">
            <span className="block text-xs font-bold tracking-[0.14em] uppercase">Workout in progress</span>
            <span className="num block text-2xl font-bold uppercase">{sessionName(active.workout.sessionTemplateId)}</span>
          </span>
          <span className="font-bold">Resume</span>
          <Icon name="chevronRight" />
        </Link>
      )}

      <Card>
        {info.week === null ? (
          <p>
            The program starts <strong>{shortDate(settings.startDate)}</strong>.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="num text-5xl leading-none font-bold">WK {info.week}</span>
              <span className={`font-bold uppercase ${PHASE_TEXT[weekDef.phase]}`}>{PHASES[weekDef.phase].name}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="accent">Target {formatRir(weekDef.targetRir)}</Badge>
              {weekDef.mainLiftLastSetRir && <Badge tone="warn">Main lifts last set {formatRir(weekDef.mainLiftLastSetRir)}</Badge>}
              {info.pause && <Badge tone="warn">Program paused this week</Badge>}
            </div>
            {week === 0 && <p className="mt-2 text-sm text-muted">{PHASES.intro.summary}</p>}
          </>
        )}
      </Card>

      <Card className="mt-3">
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Today</p>
        <p className="num mt-1 text-3xl font-bold uppercase">{planLabel(info.plan, sessionName)}</p>
        {info.plan.kind === 'walk' && <p className="mt-1 text-sm text-muted">Step goal {settings.stepGoal.toLocaleString()}</p>}
        {info.plan.kind === 'zone2' && <p className="mt-1 text-sm text-muted">Conversational pace. Step goal {settings.stepGoal.toLocaleString()}</p>}
        {session && (
          <ul className="mt-3 space-y-1">
            {session.slots.map((s) => {
              const e = exercises.get(s.exerciseId)
              if (!e) return null
              return (
                <li key={s.slotId} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="num text-lg text-muted">{formatSlotTarget(s, e, plannedSets(s, e, weekDef, weekOverride).sets)}</span>
                </li>
              )
            })}
          </ul>
        )}
        {finishedToday.length > 0 && (
          <ul className="mt-3 space-y-1">
            {finishedToday.map((w) => (
              <li key={w.id}>
                <Link to={`/workout/summary/${w.id}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-good/10 px-3 text-good">
                  <Icon name="check" className="size-5" />
                  <span className="flex-1 font-semibold">{sessionName(w.sessionTemplateId)} done</span>
                  <Icon name="chevronRight" className="size-5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!active && (
          <div className="mt-4 space-y-2">
            {session && (
              <button type="button" onClick={() => void begin(session.id)} className="min-h-16 w-full rounded-2xl bg-accent text-xl font-bold tracking-wide text-accent-ink uppercase">
                Start workout
              </button>
            )}
            <Button className="w-full" onClick={() => setPickOther(true)}>
              {session ? 'Do a different session' : 'Start a session anyway'}
            </Button>
          </div>
        )}
      </Card>

      <div className="mt-3">
        <CheckIn date={today} units={settings.units} targets={{ calories: settings.calorieTarget, protein: settings.proteinTargetG, steps: settings.stepGoal }} />
      </div>

      <Sheet open={pickOther} onClose={() => setPickOther(false)} title="Pick a session">
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Button
                className="w-full text-left"
                onClick={() => {
                  setPickOther(false)
                  void begin(s.id)
                }}
              >
                {s.name}
              </Button>
            </li>
          ))}
        </ul>
      </Sheet>
    </Screen>
  )
}
