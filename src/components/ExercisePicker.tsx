import { useMemo, useState } from 'react'
import { describe } from '../data/exercises'
import type { Exercise } from '../types'

/** Alternates first, then the whole library, filtered by a search box. */
export function ExercisePicker({
  exercises,
  alternates = [],
  excludeId,
  onPick,
}: {
  exercises: Map<string, Exercise>
  alternates?: string[]
  excludeId?: string
  onPick: (e: Exercise) => void
}) {
  const [q, setQ] = useState('')
  const all = useMemo(
    () => [...exercises.values()].filter((e) => e.id !== excludeId).sort((a, b) => a.name.localeCompare(b.name)),
    [exercises, excludeId],
  )
  const needle = q.trim().toLowerCase()
  const match = (e: Exercise) => !needle || e.name.toLowerCase().includes(needle) || e.pattern.includes(needle)
  const alts = alternates.map((id) => exercises.get(id)).filter((e): e is Exercise => !!e && match(e))
  const rest = all.filter((e) => !alternates.includes(e.id) && match(e))

  const row = (e: Exercise) => (
    <li key={e.id}>
      <button type="button" onClick={() => onPick(e)} className="flex min-h-12 w-full items-start gap-2 py-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{e.name}</span>
          {(e.description ?? describe(e)) && <span className="line-clamp-2 block text-xs text-muted">{e.description ?? describe(e)}</span>}
        </span>
        <span className="shrink-0 text-xs text-muted">{e.equipment}</span>
      </button>
    </li>
  )

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search exercises"
        aria-label="Search exercises"
        className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3"
      />
      {alts.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-bold tracking-[0.14em] text-muted uppercase">Alternates</h3>
          <ul className="divide-y divide-line">{alts.map(row)}</ul>
        </>
      )}
      <h3 className="mt-4 text-xs font-bold tracking-[0.14em] text-muted uppercase">All exercises</h3>
      <ul className="divide-y divide-line">{rest.map(row)}</ul>
    </div>
  )
}
