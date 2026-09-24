import { useState } from 'react'
import { TargetBar, TrendChart } from '../components/charts'
import { useStrengthDrops } from '../components/StrengthWarning'
import { Badge, Card, Loading, Screen, SectionTitle } from '../components/ui'
import { PROGRAM_WEEKS } from '../data/program'
import { useExercises, useSessions, useSettings } from '../db/repo'
import { useDailyLogs, useLatestBodyweight, useMeasurements, useWorkouts } from '../hooks/useData'
import { datesOfWeek, hasWeekZero, programWeek } from '../lib/calendar'
import { daysBetween, shortDate, todayIso } from '../lib/dates'
import { findPRs } from '../lib/history'
import { setsPerMuscle, WEEKLY_SET_TARGET, weekAdherence } from '../lib/stats'
import { progressStatus, type StatusLevel } from '../lib/status'
import { weeklyLiftSeries } from '../lib/strength'
import { displayLength, displayWeight, formatNumber, weightUnit } from '../lib/units'
import { weeklyReview } from '../lib/weeklyReview'
import { MUSCLES, type Muscle } from '../types'

const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  'front-delts': 'Front delts',
  'side-delts': 'Side delts',
  'rear-delts': 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
}

const LEVEL: Record<StatusLevel, { label: string; cls: string; icon: string }> = {
  green: { label: 'Good', cls: 'border-good bg-good/10 text-good', icon: '●' },
  yellow: { label: 'Watch', cls: 'border-warn bg-warn/10 text-warn', icon: '▲' },
  red: { label: 'Act', cls: 'border-bad bg-bad/10 text-bad', icon: '■' },
  unknown: { label: 'Not enough data yet', cls: 'border-line bg-surface text-muted', icon: '○' },
}

export function ProgressScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const workouts = useWorkouts()
  const logs = useDailyLogs()
  const waist = useMeasurements()
  const bw = useLatestBodyweight()
  const mainSlots = (sessions ?? []).flatMap((s) => s.slots.filter((x) => x.isMainLift))
  const { drops, tracked } = useStrengthDrops(workouts, mainSlots)
  const [liftId, setLiftId] = useState<string | null>(null)
  const today = todayIso()
  const currentWeek = settings ? programWeek(today, settings.startDate, settings.pauses) : null
  const [volWeek, setVolWeek] = useState<number | null>(null)

  if (!settings || !sessions || !exercises || !workouts || !logs || !waist) return <Loading />
  const u = settings.units
  const fmtW = (lb: number) => `${formatNumber(Math.round(displayWeight(lb, u)))} ${weightUnit(u)}`
  const finished = workouts.filter((w) => w.finishedAt !== undefined)

  // --- status card inputs
  const weighIns = logs.flatMap((d) => (d.weightLb !== undefined ? [{ date: d.date, weightLb: d.weightLb }] : []))
  const rev = weeklyReview({ weighIns, endDate: today, lossRateMinLb: settings.lossRateMinLb, lossRateMaxLb: settings.lossRateMaxLb, goal: settings.goal })
  const lastWaist = waist[waist.length - 1]
  const earlierWaist = lastWaist ? [...waist].reverse().find((m) => daysBetween(m.date, lastWaist.date) >= 21) : undefined
  const fat = logs.filter((d) => d.fatigue !== undefined && daysBetween(d.date, today) < 7 && daysBetween(d.date, today) >= 0)
  const status = progressStatus({
    ...(rev.kind !== 'insufficient-data' && rev.deltaLb !== undefined ? { weeklyLossLb: -rev.deltaLb } : {}),
    ...(lastWaist && earlierWaist ? { waistChangeIn: lastWaist.waistIn - earlierWaist.waistIn } : {}),
    strengthDrops: drops.map((d) => ({ name: d.name, percent: d.percent })),
    liftsTracked: tracked,
    ...(fat.length ? { avgFatigue: fat.reduce((s, d) => s + (d.fatigue ?? 0), 0) / fat.length } : {}),
    fatigueCount: fat.length,
    lossRateMinLb: settings.lossRateMinLb,
    lossRateMaxLb: settings.lossRateMaxLb,
  })
  const lv = LEVEL[status.level]

  // --- lifts
  const mainIds = [...new Set(mainSlots.map((s) => s.exerciseId))]
  const trainedIds = [...new Set(finished.flatMap((w) => w.sets.filter((s) => !s.isWarmup).map((s) => s.exerciseId)))]
  const liftIds = [...mainIds, ...trainedIds.filter((id) => !mainIds.includes(id) && exercises.get(id)?.type !== 'cardio' && exercises.get(id)?.type !== 'timed')]
  const selected = liftId ?? mainIds.find((id) => trainedIds.includes(id)) ?? liftIds[0]
  const selEx = selected ? exercises.get(selected) : undefined
  const series = selEx ? weeklyLiftSeries(finished, selEx, bw) : []
  const lastPt = series[series.length - 1]

  // --- volume
  const firstWeek = hasWeekZero(settings.startDate) ? 0 : 1
  const vWeek = volWeek ?? currentWeek ?? firstWeek
  const perMuscle = setsPerMuscle(finished.filter((w) => w.weekNumber === vWeek), exercises)
  const maxSets = Math.max(WEEKLY_SET_TARGET * 1.6, ...MUSCLES.map((m) => perMuscle[m]))

  // --- adherence (weeks up to now)
  const lastWeek = Math.min(Math.max(currentWeek ?? 0, firstWeek), Math.max(PROGRAM_WEEKS, currentWeek ?? 0))
  const weeks = Array.from({ length: Math.max(0, lastWeek - firstWeek + 1) }, (_, i) => firstWeek + i)
  const adherence = weeks.map((w) =>
    weekAdherence({ week: w, dates: datesOfWeek(w, settings.startDate, settings.pauses), today, schedule: settings.schedule, workouts: finished, dailyLogs: logs, stepGoal: settings.stepGoal }),
  )
  const totPlanned = adherence.reduce((s, a) => s + a.planned, 0)
  const totDone = adherence.reduce((s, a) => s + a.completed, 0)
  const totStepDays = adherence.reduce((s, a) => s + a.stepDays, 0)
  const totStepHits = adherence.reduce((s, a) => s + a.stepHits, 0)

  // --- PR history: each workout vs everything before it
  const chrono = [...finished].sort((a, b) => (a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1))
  const prs = chrono
    .flatMap((w, i) => findPRs(w, chrono.slice(0, i), exercises, bw).map((p) => ({ ...p, date: w.date })))
    .filter((p) => p.kind === 'e1rm' || p.kind === 'weight')
    .reverse()

  return (
    <Screen title="Progress" subtitle={currentWeek !== null ? `Week ${currentWeek}` : undefined}>
      <section className={`rounded-2xl border-2 p-4 ${lv.cls}`} aria-label="Progress status">
        <p className="num text-3xl font-bold uppercase">
          <span aria-hidden="true">{lv.icon}</span> {lv.label}
        </p>
        {status.level === 'unknown' ? (
          <p className="mt-1 text-sm text-muted">Needs two weeks of weigh-ins, a few waist measurements and two weeks of main lifts. Keep logging.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {status.bad.map((b) => (
              <li key={b}>✗ {b}</li>
            ))}
            {status.good.map((g) => (
              <li key={g}>✓ {g}</li>
            ))}
          </ul>
        )}
      </section>

      <SectionTitle>Key lifts</SectionTitle>
      <Card>
        {liftIds.length === 0 ? (
          <p className="text-sm text-muted">Finish a workout to start tracking lifts.</p>
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto px-4">
              <div className="flex gap-1.5" role="radiogroup" aria-label="Lift">
                {liftIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={id === selected}
                    onClick={() => setLiftId(id)}
                    className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold whitespace-nowrap ${id === selected ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'}`}
                  >
                    {exercises.get(id)?.name}
                  </button>
                ))}
              </div>
            </div>
            {lastPt && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-surface-2 p-2">
                  <div className="num text-3xl font-bold">{fmtW(lastPt.topWeightLb)}</div>
                  <div className="text-[11px] font-bold tracking-wide text-muted uppercase">Top set · wk {lastPt.week}</div>
                </div>
                <div className="rounded-xl bg-surface-2 p-2">
                  <div className="num text-3xl font-bold">{fmtW(lastPt.e1rmLb)}</div>
                  <div className="text-[11px] font-bold tracking-wide text-muted uppercase">Est. 1RM (Epley)</div>
                </div>
              </div>
            )}
            <div className="mt-3">
              <TrendChart
                title={`${selEx?.name ?? ''} top set and estimated 1RM by week`}
                data={series.map((p) => ({ label: `Wk ${p.week}`, top: displayWeight(p.topWeightLb, u), e1rm: Math.round(displayWeight(p.e1rmLb, u)) }))}
                series={[
                  { key: 'e1rm', name: 'Est. 1RM', color: 's1' },
                  { key: 'top', name: 'Top set', color: 's2' },
                ]}
                format={(v) => `${formatNumber(v)} ${weightUnit(u)}`}
                empty={`No sessions of ${selEx?.name ?? 'this lift'} yet.`}
              />
            </div>
            {selEx?.loading === 'bodyweight-plus' && <p className="text-xs text-muted">e1RM includes your latest bodyweight; top set is the added weight.</p>}
          </>
        )}
      </Card>

      <SectionTitle>Weekly sets per muscle</SectionTitle>
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="vol-week" className="flex-1 text-sm text-muted">
            Target ≥ {WEEKLY_SET_TARGET} hard sets each. Secondary muscles count ½.
          </label>
          <select id="vol-week" value={vWeek} onChange={(e) => setVolWeek(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-surface-2 px-2 text-sm">
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
        {MUSCLES.map((m) => {
          const v = perMuscle[m]
          const low = v < WEEKLY_SET_TARGET
          return (
            <div key={m} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <TargetBar label={MUSCLE_LABEL[m]} value={v} max={maxSets} target={WEEKLY_SET_TARGET} display={formatNumber(v)} tone={low ? 'warn' : 'good'} />
              </div>
              <span className="w-12 text-right">{low ? <Badge tone="warn">Low</Badge> : <Badge tone="good">OK</Badge>}</span>
            </div>
          )
        })}
        {vWeek === currentWeek && <p className="text-xs text-muted">This week so far. Muscles marked low may still get their sets later in the week.</p>}
      </Card>

      <SectionTitle>Adherence</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2">
            <div className="num text-3xl font-bold">
              {totDone}/{totPlanned}
            </div>
            <div className="text-[11px] font-bold tracking-wide text-muted uppercase">Workouts done</div>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <div className="num text-3xl font-bold">{totStepDays ? `${Math.round((totStepHits / totStepDays) * 100)}%` : '—'}</div>
            <div className="text-[11px] font-bold tracking-wide text-muted uppercase">Step goal hit</div>
          </div>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-semibold">Week</th>
              <th className="py-1 font-semibold">Workouts</th>
              <th className="py-1 text-right font-semibold">Steps goal</th>
            </tr>
          </thead>
          <tbody>
            {[...adherence].reverse().map((a) => (
              <tr key={a.week} className="border-t border-line">
                <td className="num py-1.5 text-base">{a.week}</td>
                <td className="py-1.5">
                  <span className="num text-base">
                    {a.completed}/{a.planned}
                  </span>{' '}
                  {a.planned > 0 && a.completed >= a.planned && <Badge tone="good">All</Badge>}
                </td>
                <td className="num py-1.5 text-right text-base">{a.stepDays ? `${a.stepHits}/${a.stepDays} days` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle>PR history</SectionTitle>
      <Card className="p-0">
        {prs.length === 0 ? (
          <p className="p-4 text-sm text-muted">PRs show up from your second session of each lift.</p>
        ) : (
          <ul className="divide-y divide-line">
            {prs.slice(0, 30).map((p, i) => (
              <li key={`${p.date}-${p.exerciseId}-${p.kind}-${i}`} className="flex items-center gap-2 px-4 py-2">
                <span className="num w-14 text-base text-muted">{shortDate(p.date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{exercises.get(p.exerciseId)?.name}</span>
                <Badge tone={p.kind === 'e1rm' ? 'accent' : 'good'}>{p.kind === 'e1rm' ? 'e1RM' : 'Weight'}</Badge>
                <span className="num w-20 text-right text-lg">{fmtW(p.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {lastWaist && <p className="mt-4 text-center text-xs text-muted">Latest waist {formatNumber(displayLength(lastWaist.waistIn, u))} · weights in {weightUnit(u)}</p>}
    </Screen>
  )
}
