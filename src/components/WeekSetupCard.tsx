import { useExercises, saveWeekOverride, useWeekOverride } from '../db/repo'
import type { SessionTemplate, WeekDefinition, WeekOverride } from '../types'
import { Card, Segmented, Toggle } from './ui'

/**
 * The per-week choices the program asks for:
 * weeks 1-4 an optional extra set for shoulders and core; weeks 5-8 (and
 * extension weeks) the weakest lift that gets a 4th set and the cardio bump.
 */
export function WeekSetupCard({ week, sessions, compact = false }: { week: WeekDefinition; sessions: SessionTemplate[]; compact?: boolean }) {
  const override = useWeekOverride(week.number)
  const exercises = useExercises()
  if (!exercises) return null
  const o: WeekOverride = override ?? { weekNumber: week.number, extraSets: {} }
  const save = (patch: Partial<WeekOverride>) => void saveWeekOverride({ ...o, ...patch })

  if (week.phase === 'base' || week.phase === 'intro') {
    return (
      <Card>
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Week {week.number} setup</p>
        <Toggle
          label="Add 1 set to shoulders and core"
          hint="Only if recovery feels good. Applies to overhead press, lateral raises, rear delts and ab work this week."
          checked={!!o.shouldersCoreBonus}
          onChange={(v) => save({ shouldersCoreBonus: v })}
        />
      </Card>
    )
  }

  if (week.phase !== 'push' && week.phase !== 'extension') return null

  const mainSlots = sessions.flatMap((s) => s.slots.filter((x) => x.isMainLift).map((x) => ({ slot: x, session: s })))
  const missing = !o.weakestLiftSlotId || !o.cardioBump
  if (compact && !missing) return null

  return (
    <Card className={missing ? 'border-accent' : ''}>
      <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Week {week.number} setup{missing ? ' · choose' : ''}</p>
      <label className="mt-2 block text-sm font-medium" htmlFor={`weakest-${week.number}`}>
        Weakest lift (gets a 4th set this week)
      </label>
      <select
        id={`weakest-${week.number}`}
        value={o.weakestLiftSlotId ?? ''}
        onChange={(e) => {
          const { weakestLiftSlotId: _drop, ...rest } = o
          save(e.target.value ? { ...rest, weakestLiftSlotId: e.target.value } : rest)
        }}
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3"
      >
        <option value="">Choose…</option>
        {mainSlots.map(({ slot, session }) => (
          <option key={slot.slotId} value={slot.slotId}>
            {exercises.get(slot.exerciseId)?.name ?? slot.exerciseId} ({session.short})
          </option>
        ))}
      </select>
      <p className="mt-3 mb-1 text-sm font-medium">Cardio bump</p>
      <Segmented
        label="Cardio bump"
        value={o.cardioBump ?? ('' as 'extra-zone2')}
        onChange={(cardioBump) => save({ cardioBump })}
        options={[
          { value: 'extra-zone2', label: '4th zone 2 session' },
          { value: 'longer-finisher', label: 'Finisher +5 min' },
        ]}
      />
    </Card>
  )
}
