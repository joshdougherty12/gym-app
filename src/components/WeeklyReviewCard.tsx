import { useState } from 'react'
import { db } from '../db/db'
import { updateSettings } from '../db/repo'
import { useDailyLogs, useReviews, useWorkouts } from '../hooks/useData'
import { programWeek } from '../lib/calendar'
import { shortDate, todayIso } from '../lib/dates'
import { timestamp } from '../lib/id'
import { lastReviewEnd } from '../lib/review'
import { weeklyReview, type ReviewResult } from '../lib/weeklyReview'
import { displayBodyweight, formatNumber, weightUnit } from '../lib/units'
import type { ExerciseSlot, SessionTemplate, Settings, WeeklyReview } from '../types'
import { Badge, Button, Card } from './ui'
import { StrengthWarning } from './StrengthWarning'

const TONE: Record<string, 'good' | 'warn' | 'bad' | 'muted'> = {
  'on-track': 'good',
  watch: 'muted',
  'insufficient-data': 'muted',
  'losing-fast': 'warn',
  'too-slow': 'warn',
  gaining: 'bad',
  'surplus-too-fast': 'warn',
  'surplus-losing': 'warn',
}

const LABEL: Record<string, string> = {
  'on-track': 'On track',
  watch: 'Watch',
  'insufficient-data': 'Not enough data',
  'losing-fast': 'Losing fast',
  'too-slow': 'Too slow',
  gaining: 'Gaining',
  'surplus-too-fast': 'Gaining fast',
  'surplus-losing': 'Still losing',
}

/**
 * Weekly review: runs for the last complete week (Sunday) or on demand for
 * the 7 days up to today. Accepting updates the calorie or step target.
 */
export function WeeklyReviewCard({ settings, sessions }: { settings: Settings; sessions: SessionTemplate[] }) {
  const logs = useDailyLogs()
  const reviews = useReviews()
  const workouts = useWorkouts()
  const [onDemand, setOnDemand] = useState(false)
  const today = todayIso()
  const end = onDemand ? today : lastReviewEnd(today)
  const week = programWeek(end, settings.startDate, settings.pauses)
  if (!logs || !reviews || !workouts) return null

  const u = settings.units
  const fmt = (lb: number) => `${formatNumber(Math.round(displayBodyweight(lb, u) * 10) / 10)} ${weightUnit(u)}`
  const weighIns = logs.flatMap((d) => (d.weightLb !== undefined ? [{ date: d.date, weightLb: d.weightLb }] : []))
  const r: ReviewResult = weeklyReview({ weighIns, endDate: end, lossRateMinLb: settings.lossRateMinLb, lossRateMaxLb: settings.lossRateMaxLb, goal: settings.goal })
  const saved = week !== null ? reviews.find((x) => x.weekNumber === week) : undefined
  const mainSlots: ExerciseSlot[] = sessions.flatMap((s) => s.slots.filter((x) => x.isMainLift))

  const record = async (patch: Partial<WeeklyReview>) => {
    if (week === null) return
    const row: WeeklyReview = {
      weekNumber: week,
      createdAt: timestamp(),
      weighInCount: r.weighInCount,
      kind: r.kind,
      recommendation: r.recommendation,
      accepted: false,
      ...(r.avgWeightLb !== undefined ? { avgWeightLb: r.avgWeightLb } : {}),
      ...(r.prevAvgWeightLb !== undefined ? { prevAvgWeightLb: r.prevAvgWeightLb } : {}),
      ...(r.deltaLb !== undefined ? { deltaLb: r.deltaLb } : {}),
      ...(r.stepDelta !== undefined ? { suggestedStepDelta: r.stepDelta } : {}),
      ...patch,
    }
    await db.weeklyReviews.put(row)
  }

  const acceptCalories = async (delta: number) => {
    await updateSettings({ calorieTarget: settings.calorieTarget + delta })
    await record({ choice: 'calories', accepted: true, appliedCalorieDelta: delta, suggestedCalorieDelta: delta })
  }
  const acceptSteps = async (delta: number) => {
    await updateSettings({ stepGoal: settings.stepGoal + delta })
    await record({ choice: 'steps', accepted: true })
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <h2 className="num flex-1 text-2xl font-bold uppercase">Weekly review</h2>
        <Badge tone={TONE[r.kind] ?? 'muted'}>{LABEL[r.kind] ?? r.kind}</Badge>
      </div>
      <p className="text-xs text-muted">
        {onDemand ? `7 days to ${shortDate(end)} (on demand)` : `Week ending Sun ${shortDate(end)}`}
        {week !== null ? ` · program week ${week}` : ''}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-2">
          <div className="num text-2xl font-bold">{r.avgWeightLb !== undefined ? fmt(r.avgWeightLb) : '—'}</div>
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">7-day avg</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <div className="num text-2xl font-bold">{r.deltaLb !== undefined ? `${r.deltaLb > 0 ? '+' : r.deltaLb < 0 ? '−' : ''}${fmt(Math.abs(r.deltaLb))}` : '—'}</div>
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">vs last week</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <div className="num text-2xl font-bold">{r.weighInCount}/7</div>
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">weigh-ins</div>
        </div>
      </div>

      <p className="mt-3">{r.recommendation}</p>

      {saved?.accepted ? (
        <p className="mt-2 text-sm text-good">
          Applied: {saved.choice === 'steps' ? `+${(saved.suggestedStepDelta ?? 2000).toLocaleString()} steps/day` : `${(saved.appliedCalorieDelta ?? 0) > 0 ? '+' : ''}${saved.appliedCalorieDelta} kcal/day`}. Targets now {settings.calorieTarget.toLocaleString()} kcal, {settings.stepGoal.toLocaleString()} steps.
        </p>
      ) : saved?.choice === 'dismissed' ? (
        <p className="mt-2 text-sm text-muted">Dismissed for week {saved.weekNumber}.</p>
      ) : r.calorieRange ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            {[r.calorieRange.min, r.calorieRange.max]
              .sort((a, b) => Math.abs(a) - Math.abs(b))
              .map((d) => (
                <Button key={d} variant="primary" className="flex-1" onClick={() => void acceptCalories(d)}>
                  {d > 0 ? '+' : ''}
                  {d} kcal
                </Button>
              ))}
          </div>
          {r.stepDelta !== undefined && (
            <Button className="w-full" onClick={() => void acceptSteps(r.stepDelta ?? 2000)}>
              +{r.stepDelta.toLocaleString()} steps/day instead
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => void record({ choice: 'dismissed' })}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StrengthWarning workouts={workouts} mainSlots={mainSlots} settings={settings} />

      <Button variant="ghost" className="mt-2 w-full text-sm" onClick={() => setOnDemand((v) => !v)}>
        {onDemand ? 'Back to last full week' : 'Run on demand (last 7 days)'}
      </Button>
    </Card>
  )
}
