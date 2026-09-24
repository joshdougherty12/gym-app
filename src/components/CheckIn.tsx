import { useLiveQuery } from 'dexie-react-hooks'
import { useId } from 'react'
import { db } from '../db/db'
import { displayWeight, formatNumber, inputWeightToLb, weightUnit } from '../lib/units'
import type { DailyLog, Units } from '../types'
import { Card } from './ui'

type NumField = 'weightLb' | 'steps' | 'calories' | 'proteinG'

async function save(date: string, patch: Partial<DailyLog>) {
  await db.transaction('rw', db.dailyLogs, async () => {
    const cur = (await db.dailyLogs.get(date)) ?? { date }
    const next: DailyLog = { ...cur, ...patch }
    for (const k of Object.keys(patch) as (keyof DailyLog)[]) if (patch[k] === undefined) delete next[k]
    await db.dailyLogs.put(next)
  })
}

/** Daily check-in: weight, steps, calories, protein, fatigue. Saves as you leave each field. */
export function CheckIn({ date, units, targets }: { date: string; units: Units; targets: { calories: number; protein: number; steps: number } }) {
  const log = useLiveQuery(() => db.dailyLogs.get(date), [date])
  const base = useId()

  const fields: { key: NumField; label: string; suffix: string; target?: number; toStored: (v: number) => number; toShown: (v: number) => number }[] = [
    { key: 'weightLb', label: 'Weight', suffix: weightUnit(units), toStored: (v) => inputWeightToLb(v, units), toShown: (v) => displayWeight(v, units) },
    { key: 'steps', label: 'Steps', suffix: '', target: targets.steps, toStored: (v) => v, toShown: (v) => v },
    { key: 'calories', label: 'Calories', suffix: 'kcal', target: targets.calories, toStored: (v) => v, toShown: (v) => v },
    { key: 'proteinG', label: 'Protein', suffix: 'g', target: targets.protein, toStored: (v) => v, toShown: (v) => v },
  ]

  return (
    <Card>
      <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Daily check-in</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {fields.map((f) => {
          const id = `${base}-${f.key}`
          const v = log?.[f.key]
          return (
            <div key={f.key} className="rounded-xl bg-surface-2 px-3 py-2">
              <label htmlFor={id} className="block text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
                {f.label}
                {f.target ? <span className="font-normal normal-case"> / {f.target.toLocaleString()}</span> : null}
              </label>
              <div className="flex items-baseline gap-1">
                <input
                  id={id}
                  key={`${date}-${f.key}-${v ?? ''}`}
                  inputMode={f.key === 'weightLb' ? 'decimal' : 'numeric'}
                  defaultValue={v === undefined ? '' : formatNumber(f.toShown(v))}
                  placeholder="—"
                  onBlur={(e) => {
                    const t = e.target.value.trim()
                    const n = Number(t)
                    if (t === '') void save(date, { [f.key]: undefined })
                    else if (Number.isFinite(n) && n >= 0) void save(date, { [f.key]: f.toStored(n) })
                  }}
                  className="num min-h-11 w-full min-w-0 bg-transparent text-3xl font-bold outline-none"
                />
                <span className="text-xs text-muted">{f.suffix}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Fatigue (1 fresh – 5 wrecked)</p>
        <div role="radiogroup" aria-label="Fatigue" className="flex gap-1.5">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={log?.fatigue === n}
              onClick={() => void save(date, { fatigue: log?.fatigue === n ? undefined : n })}
              className={`num min-h-11 flex-1 rounded-xl text-xl font-bold ${log?.fatigue === n ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
