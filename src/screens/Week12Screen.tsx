import { useNavigate } from 'react-router'
import { Button, Card, Loading, Screen, SectionTitle } from '../components/ui'
import { useExercises, updateSettings, useSessions, useSettings } from '../db/repo'
import { useDailyLogs, useLatestBodyweight, useMeasurements, useWorkouts } from '../hooks/useData'
import { todayIso } from '../lib/dates'
import { timestamp } from '../lib/id'
import { movingAverage } from '../lib/movingAverage'
import { weeklyLiftSeries } from '../lib/strength'
import { displayBodyweight, displayLength, formatNumber, lengthUnit, weightUnit } from '../lib/units'
import { estimateMaintenance } from '../lib/weeklyReview'

const SURPLUS_KCAL = 200

export function Week12Screen() {
  const settings = useSettings()
  const sessions = useSessions()
  const exercises = useExercises()
  const logs = useDailyLogs()
  const waist = useMeasurements()
  const workouts = useWorkouts()
  const bw = useLatestBodyweight()
  const navigate = useNavigate()
  if (!settings || !sessions || !exercises || !logs || !waist || !workouts) return <Loading />

  const u = settings.units
  const fw = (lb: number) => `${formatNumber(Math.round(displayBodyweight(lb, u) * 10) / 10)} ${weightUnit(u)}`
  const fwWhole = (lb: number) => `${Math.round(displayBodyweight(lb, u))} ${weightUnit(u)}`
  const today = todayIso()
  const weights = logs.flatMap((d) => (d.weightLb !== undefined ? [{ date: d.date, value: d.weightLb }] : []))
  const avg = movingAverage(weights, 7)
  const startAvg = avg[Math.min(6, avg.length - 1)]
  const endAvg = avg[avg.length - 1]
  const firstWaist = waist[0]
  const lastWaist = waist[waist.length - 1]
  const finished = workouts.filter((w) => w.finishedAt !== undefined)
  const mainIds = [...new Set(sessions.flatMap((s) => s.slots.filter((x) => x.isMainLift).map((x) => x.exerciseId)))]
  const lifts = mainIds.flatMap((id) => {
    const e = exercises.get(id)
    if (!e) return []
    const s = weeklyLiftSeries(finished, e, bw)
    const first = s[0]
    const last = s[s.length - 1]
    if (!first || !last || s.length < 2) return []
    return [{ name: e.name, from: first.e1rmLb, to: last.e1rmLb }]
  })

  const intake = logs.flatMap((d) => (d.calories !== undefined ? [{ date: d.date, calories: d.calories }] : []))
  const weighIns = logs.flatMap((d) => (d.weightLb !== undefined ? [{ date: d.date, weightLb: d.weightLb }] : []))
  const maint = estimateMaintenance({ intake, weighIns, endDate: today })
  const maintenance = maint?.kcal ?? settings.calorieTarget + 400
  const decided = settings.week12Decision

  const chooseCut = async () => {
    await updateSettings({ goal: 'cut', week12Decision: { choice: 'continue-cut', decidedAt: timestamp() } })
    navigate('/')
  }
  const chooseSurplus = async () => {
    await updateSettings({
      goal: 'surplus',
      calorieTarget: maintenance + SURPLUS_KCAL,
      week12Decision: { choice: 'surplus', decidedAt: timestamp(), maintenanceKcal: maintenance },
    })
    navigate('/')
  }

  return (
    <Screen title="Week 12" subtitle="Look at the trend, then decide what's next" back="/">
      <SectionTitle>12-week trend</SectionTitle>
      <Card className="space-y-2">
        <Row label="Weight (7-day avg)" value={startAvg && endAvg ? `${fw(startAvg.value)} → ${fw(endAvg.value)} (${endAvg.value <= startAvg.value ? '−' : '+'}${fw(Math.abs(endAvg.value - startAvg.value))})` : 'Not enough weigh-ins'} />
        <Row
          label="Waist"
          value={firstWaist && lastWaist && firstWaist !== lastWaist ? `${formatNumber(displayLength(firstWaist.waistIn, u))} → ${formatNumber(displayLength(lastWaist.waistIn, u))} ${lengthUnit(u)}` : 'Measure it now (Body tab)'}
        />
        {lifts.length === 0 ? (
          <Row label="Strength" value="Not enough lift history" />
        ) : (
          lifts.map((l) => <Row key={l.name} label={l.name} value={`e1RM ${fwWhole(l.from)} → ${fwWhole(l.to)} (${l.to >= l.from ? '+' : '−'}${Math.round((Math.abs(l.to - l.from) / l.from) * 100)}%)`} />)
        )}
        <Row label="Workouts logged" value={String(finished.length)} />
      </Card>
      <p className="mt-2 text-sm text-muted">Before deciding: take front, side and back photos and measure your waist (Body tab).</p>

      <SectionTitle>Decide</SectionTitle>
      {decided && (
        <p className="mb-2 text-sm text-good">
          Current choice: {decided.choice === 'surplus' ? `small surplus (${settings.calorieTarget.toLocaleString()} kcal)` : 'keep cutting'}. You can change it.
        </p>
      )}
      <div className="space-y-3">
        <Card>
          <h2 className="num text-2xl font-bold uppercase">Keep cutting 4-8 more weeks</h2>
          <p className="mt-1 text-sm text-muted">
            Calories stay at {settings.calorieTarget.toLocaleString()} and the weekly review keeps adjusting them. The program carries on with weeks 5-8
            style progression and a deload every 5th week.
          </p>
          <Button variant="primary" className="mt-3 w-full" onClick={() => void chooseCut()}>
            Keep cutting
          </Button>
        </Card>
        <Card>
          <h2 className="num text-2xl font-bold uppercase">Small surplus</h2>
          <p className="mt-1 text-sm text-muted">
            Estimated maintenance <strong className="text-ink">{maintenance.toLocaleString()} kcal</strong>
            {maint ? ` (${maint.basis})` : ' (rough guess: not enough logged calories and weigh-ins in the last two weeks, so this is today’s target + 400)'}. New target{' '}
            <strong className="text-ink">{(maintenance + SURPLUS_KCAL).toLocaleString()} kcal</strong>. Aim to gain about 0.25-0.5 lb a week.
          </p>
          <Button variant="primary" className="mt-3 w-full" onClick={() => void chooseSurplus()}>
            Move to {(maintenance + SURPLUS_KCAL).toLocaleString()} kcal
          </Button>
        </Card>
      </div>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
      <span className="w-36 shrink-0 text-sm text-muted">{label}</span>
      <span className="num text-lg">{value}</span>
    </div>
  )
}
