import { useId, useState } from 'react'
import { db } from '../db/db'
import { isIsoDate, todayIso } from '../lib/dates'
import { newId } from '../lib/id'
import type { CardioKind } from '../types'
import { Button, Segmented } from './ui'

export const CARDIO_KINDS: { value: CardioKind; label: string }[] = [
  { value: 'zone2', label: 'Zone 2' },
  { value: 'finisher', label: 'Finisher' },
  { value: 'walk', label: 'Walk' },
  { value: 'other', label: 'Other' },
]

export function CardioQuickLog({ defaultKind = 'zone2', defaultMinutes = 30, onDone }: { defaultKind?: CardioKind; defaultMinutes?: number; onDone?: () => void }) {
  const [kind, setKind] = useState<CardioKind>(defaultKind)
  const [minutes, setMinutes] = useState(defaultMinutes)
  const [date, setDate] = useState(todayIso())
  const id = useId()
  return (
    <div className="space-y-3">
      <Segmented label="Cardio type" value={kind} onChange={setKind} options={CARDIO_KINDS} />
      <div className="flex items-center gap-2">
        <button type="button" aria-label="5 minutes less" onClick={() => setMinutes((m) => Math.max(0, m - 5))} className="num min-h-12 min-w-12 rounded-xl bg-surface-2 text-xl font-bold">
          −5
        </button>
        <label htmlFor={id} className="sr-only">
          Minutes
        </label>
        <input id={id} inputMode="numeric" value={minutes} onChange={(e) => Number.isFinite(Number(e.target.value)) && setMinutes(Number(e.target.value))} className="num min-h-12 w-full min-w-0 flex-1 rounded-xl bg-surface-2 text-center text-3xl font-bold" />
        <button type="button" aria-label="5 minutes more" onClick={() => setMinutes((m) => m + 5)} className="num min-h-12 min-w-12 rounded-xl bg-surface-2 text-xl font-bold">
          +5
        </button>
        <span className="text-sm text-muted">min</span>
      </div>
      <input type="date" aria-label="Date" value={date} max={todayIso()} onChange={(e) => isIsoDate(e.target.value) && setDate(e.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3" />
      <Button
        variant="primary"
        className="w-full"
        disabled={minutes <= 0}
        onClick={() => {
          void db.cardio.put({ id: newId('cardio'), date, kind, minutes }).then(() => onDone?.())
        }}
      >
        Log {minutes} min {CARDIO_KINDS.find((k) => k.value === kind)?.label.toLowerCase()}
      </Button>
    </div>
  )
}

