import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { PHASE_TEXT } from '../components/phase'
import { Badge, Card, Loading, Screen } from '../components/ui'
import { PHASES } from '../data/program'
import { useExercises, useSessions, useSettings } from '../db/repo'
import { shortDate, todayIso, WEEKDAY_LONG, weekdayOf } from '../lib/dates'
import { dayInfo, planLabel } from '../lib/today'
import { formatRir, formatSlotTarget } from '../lib/weekPlan'

export function TodayScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  if (!settings || !sessions || !exercises) return <Loading />

  const today = todayIso()
  const info = dayInfo(today, settings)
  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? 'Unknown session'
  const session = info.plan.kind === 'session' ? sessions.find((s) => s.id === (info.plan.kind === 'session' ? info.plan.sessionId : '')) : undefined

  return (
    <Screen title={WEEKDAY_LONG[weekdayOf(today)]} subtitle={shortDate(today)}>
      <Card>
        {info.week === null || !info.weekDef ? (
          <p>
            The program starts <strong>{shortDate(settings.startDate)}</strong>.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="num text-5xl leading-none font-bold">WK {info.week}</span>
              <span className={`font-bold uppercase ${PHASE_TEXT[info.weekDef.phase]}`}>{PHASES[info.weekDef.phase].name}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="accent">Target {formatRir(info.weekDef.targetRir)}</Badge>
              {info.pause && <Badge tone="warn">Program paused this week</Badge>}
            </div>
          </>
        )}
      </Card>

      <Card className="mt-3">
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Today</p>
        <p className="num mt-1 text-3xl font-bold uppercase">{planLabel(info.plan, sessionName)}</p>
        {info.plan.kind === 'walk' && <p className="mt-1 text-sm text-muted">Step goal {settings.stepGoal.toLocaleString()}</p>}
        {info.plan.kind === 'zone2' && <p className="mt-1 text-sm text-muted">Conversational pace. Step goal {settings.stepGoal.toLocaleString()}</p>}
        {session && (
          <>
            <ul className="mt-3 space-y-1">
              {session.slots.map((s) => {
                const e = exercises.get(s.exerciseId)
                if (!e) return null
                return (
                  <li key={s.slotId} className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="num text-lg text-muted">{formatSlotTarget(s, e)}</span>
                  </li>
                )
              })}
            </ul>
            <Link
              to={`/program/session/${session.id}${info.week !== null ? `?week=${info.week}` : ''}`}
              className="mt-4 flex min-h-12 items-center justify-center gap-1 rounded-xl bg-surface-2 font-semibold"
            >
              View session <Icon name="chevronRight" className="size-5" />
            </Link>
            <p className="mt-2 text-center text-xs text-muted">Workout logging arrives in the next build phase.</p>
          </>
        )}
      </Card>
    </Screen>
  )
}
