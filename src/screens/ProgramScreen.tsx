import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Badge, Button, Card, Loading, Screen, SectionTitle, Sheet } from '../components/ui'
import { Icon } from '../components/Icon'
import { PHASE_BG, PHASE_TEXT } from '../components/phase'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { PHASES, PROGRAM_WEEKS, weekDefinition } from '../data/program'
import { updateSettings, useSessions, useSettings, useWorkoutsForWeek } from '../db/repo'
import { datesOfWeek, hasWeekZero, programWeek } from '../lib/calendar'
import { daysBetween, shortDate, todayIso, WEEKDAY_SHORT, weekdayOf } from '../lib/dates'
import { planLabel } from '../lib/today'
import { formatRir } from '../lib/weekPlan'
import type { PhaseId } from '../types'

export function ProgramScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const [params, setParams] = useSearchParams()
  const [editSchedule, setEditSchedule] = useState(false)
  const today = todayIso()

  const currentWeek = settings ? programWeek(today, settings.startDate, settings.pauses) : null
  const firstWeek = settings && hasWeekZero(settings.startDate) ? 0 : 1
  const lastWeek = Math.max(PROGRAM_WEEKS, currentWeek ?? 0)
  const paramWeek = Number(params.get('week'))
  const selected =
    params.get('week') !== null && Number.isInteger(paramWeek) && paramWeek >= firstWeek && paramWeek <= lastWeek
      ? paramWeek
      : Math.max(firstWeek, currentWeek ?? firstWeek)

  const workouts = useWorkoutsForWeek(selected)

  if (!settings || !sessions) return <Loading />

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? 'Unknown session'
  const def = weekDefinition(selected)
  const dates = datesOfWeek(selected, settings.startDate, settings.pauses)
  const weeks = Array.from({ length: lastWeek - firstWeek + 1 }, (_, i) => firstWeek + i)

  return (
    <Screen
      title="Program"
      subtitle={
        currentWeek === null ? (
          `Starts ${shortDate(settings.startDate)}`
        ) : (
          <>
            Week {currentWeek} · <span className={PHASE_TEXT[weekDefinition(currentWeek).phase]}>{PHASES[weekDefinition(currentWeek).phase].name}</span>
          </>
        )
      }
    >
      {/* Week strip */}
      <nav aria-label="Weeks" className="-mx-4 overflow-x-auto px-4 pb-1">
        <ol className="flex gap-1.5">
          {weeks.map((w) => {
            const phase = weekDefinition(w).phase
            const isSel = w === selected
            return (
              <li key={w}>
                <button
                  type="button"
                  onClick={() => setParams({ week: String(w) }, { replace: true })}
                  aria-current={isSel ? 'true' : undefined}
                  aria-label={`Week ${w}, ${PHASES[phase].name}${w === currentWeek ? ', current week' : ''}`}
                  className={`relative flex h-14 w-11 flex-col items-center justify-center rounded-xl border ${
                    isSel ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                  }`}
                >
                  <span className="num text-xl leading-none font-bold">{w}</span>
                  <span className={`mt-1 h-1 w-5 rounded-full ${PHASE_BG[phase]}`} />
                  {w === currentWeek && <span className="absolute -top-1 right-0.5 size-2 rounded-full bg-accent" />}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Selected week */}
      <Card className="mt-3">
        <div className="flex items-baseline gap-2">
          <h2 className="num text-3xl font-bold uppercase">Week {selected}</h2>
          <span className={`text-sm font-bold uppercase ${PHASE_TEXT[def.phase]}`}>{PHASES[def.phase].name}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="accent">Target {formatRir(def.targetRir)}</Badge>
          {def.mainLiftLastSetRir && <Badge tone="warn">Main lifts: last set {formatRir(def.mainLiftLastSetRir)}</Badge>}
          {def.phase === 'deload' && <Badge tone="good">~40% fewer sets · same weights</Badge>}
        </div>
        <p className="mt-2 text-sm text-muted">{def.notes}</p>
      </Card>

      <SectionTitle>Days</SectionTitle>
      <Card className="p-0">
        {dates.length === 0 ? (
          <p className="p-4 text-sm text-muted">No dates for this week.</p>
        ) : (
          <ul className="divide-y divide-line">
            {dates.map((date) => {
              const plan = settings.schedule[weekdayOf(date)]
              const isToday = date === today
              const past = daysBetween(date, today) > 0
              const done =
                plan.kind === 'session' &&
                (workouts ?? []).some((w) => w.sessionTemplateId === plan.sessionId && w.finishedAt !== undefined)
              const status = done ? (
                <Badge tone="good">Done</Badge>
              ) : isToday ? (
                <Badge tone="accent">Today</Badge>
              ) : past && plan.kind === 'session' ? (
                <Badge tone="bad">Missed</Badge>
              ) : null
              const content = (
                <>
                  <div className="w-12 shrink-0">
                    <div className={`text-xs font-bold uppercase ${isToday ? 'text-accent' : 'text-muted'}`}>{WEEKDAY_SHORT[weekdayOf(date)]}</div>
                    <div className="num text-lg leading-none">{shortDate(date)}</div>
                  </div>
                  <div className={`min-w-0 flex-1 font-semibold ${plan.kind === 'session' ? '' : 'text-muted'}`}>
                    {planLabel(plan, sessionName)}
                  </div>
                  {status}
                  {plan.kind === 'session' && <Icon name="chevronRight" className="size-5 text-muted" />}
                </>
              )
              return (
                <li key={date}>
                  {plan.kind === 'session' ? (
                    <Link to={`/program/session/${plan.sessionId}?week=${selected}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-4 py-2">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Button className="mt-3 w-full" onClick={() => setEditSchedule(true)}>
        Move sessions between days
      </Button>

      <SectionTitle>Phases</SectionTitle>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {(['intro', 'base', 'push', 'deload', 'peak'] as PhaseId[])
            .filter((p) => p !== 'intro' || firstWeek === 0)
            .map((p) => (
              <li key={p} className="flex gap-3 px-4 py-3">
                <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${PHASE_BG[p]}`} />
                <div>
                  <div className="font-semibold">
                    {PHASES[p].name} <span className="text-sm font-normal text-muted">· {PHASES[p].weeks}</span>
                  </div>
                  <p className="text-sm text-muted">{PHASES[p].summary}</p>
                </div>
              </li>
            ))}
        </ul>
      </Card>

      <Sheet open={editSchedule} onClose={() => setEditSchedule(false)} title="Weekly schedule">
        <p className="mb-2 text-sm text-muted">
          Picking a session that's already on another day swaps the two days. The program itself doesn't change.
        </p>
        <ScheduleEditor schedule={settings.schedule} sessions={sessions} onChange={(schedule) => void updateSettings({ schedule })} />
      </Sheet>
    </Screen>
  )
}
