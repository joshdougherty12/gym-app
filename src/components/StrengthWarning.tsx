import { useExercises } from '../db/repo'
import { useLatestBodyweight } from '../hooks/useData'
import { updateSettings } from '../db/repo'
import { nextMonday, shortDate, todayIso } from '../lib/dates'
import { newId } from '../lib/id'
import { detectStrengthDrop, weeklyLiftSeries, type StrengthDrop } from '../lib/strength'
import type { ExerciseSlot, Settings, WorkoutLog } from '../types'
import { Button } from './ui'

export function useStrengthDrops(workouts: readonly WorkoutLog[] | undefined, mainSlots: ExerciseSlot[]): { drops: (StrengthDrop & { name: string })[]; tracked: number } {
  const exercises = useExercises()
  const bw = useLatestBodyweight()
  if (!workouts || !exercises) return { drops: [], tracked: 0 }
  const ids = [...new Set(mainSlots.map((s) => s.exerciseId))]
  const drops: (StrengthDrop & { name: string })[] = []
  let tracked = 0
  for (const id of ids) {
    const e = exercises.get(id)
    if (!e) continue
    const series = weeklyLiftSeries(workouts, e, bw)
    if (series.length >= 2) tracked++
    const d = detectStrengthDrop(id, series)
    if (d) drops.push({ ...d, name: e.name })
  }
  return { drops, tracked }
}

/** Strength falling 2+ weeks on a main lift: suggest an extra deload or a few maintenance days. */
export function StrengthWarning({ workouts, mainSlots, settings }: { workouts: readonly WorkoutLog[]; mainSlots: ExerciseSlot[]; settings: Settings }) {
  const { drops } = useStrengthDrops(workouts, mainSlots)
  if (drops.length === 0) return null
  const start = nextMonday(todayIso())
  const planned = settings.pauses.some((p) => p.kind === 'deload' && p.start === start)
  return (
    <div className="mt-3 rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm" role="alert">
      <p className="font-bold text-warn">⚠ Strength dropping 2+ weeks</p>
      <ul className="mt-1 list-disc pl-5">
        {drops.map((d) => (
          <li key={d.exerciseId}>
            {d.name}: down {d.weeks} weeks running (e1RM −{Math.round(d.percent * 10) / 10}%)
          </li>
        ))}
      </ul>
      <p className="mt-2">Consider an extra deload week, or a few days at maintenance calories (about {(settings.calorieTarget + 400).toLocaleString()} kcal).</p>
      {planned ? (
        <p className="mt-2 text-good">Extra deload week planned from {shortDate(start)}.</p>
      ) : (
        <Button
          className="mt-2 w-full"
          onClick={() => void updateSettings({ pauses: [...settings.pauses, { id: newId('deload'), start, weeks: 1, kind: 'deload', note: 'Extra deload (strength drop)' }] })}
        >
          Add an extra deload week from {shortDate(start)}
        </Button>
      )}
    </div>
  )
}
