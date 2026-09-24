import { useId } from 'react'
import { WEEKDAY_LONG } from '../lib/dates'
import { assignDay, WEEK_ORDER } from '../lib/schedule'
import type { DayPlan, Schedule, SessionTemplate } from '../types'

function encode(p: DayPlan): string {
  switch (p.kind) {
    case 'session':
      return `session:${p.sessionId}`
    case 'zone2':
      return `zone2:${p.minutes}`
    default:
      return p.kind
  }
}

function decode(v: string): DayPlan {
  if (v.startsWith('session:')) return { kind: 'session', sessionId: v.slice(8) }
  if (v.startsWith('zone2:')) return { kind: 'zone2', minutes: Number(v.slice(6)) || 30 }
  if (v === 'walk') return { kind: 'walk' }
  return { kind: 'rest' }
}

/**
 * One select per weekday. Picking a session that already sits on another day
 * swaps the two days, so the week always has each session exactly once.
 */
export function ScheduleEditor({
  schedule,
  sessions,
  onChange,
}: {
  schedule: Schedule
  sessions: SessionTemplate[]
  onChange: (s: Schedule) => void
}) {
  const base = useId()
  return (
    <ul className="divide-y divide-line">
      {WEEK_ORDER.map((day) => {
        const id = `${base}-${day}`
        const current = schedule[day]
        return (
          <li key={day} className="flex items-center gap-3 py-2">
            <label htmlFor={id} className="w-24 shrink-0 text-sm font-semibold">
              {WEEKDAY_LONG[day]}
            </label>
            <select
              id={id}
              value={encode(current)}
              onChange={(e) => onChange(assignDay(schedule, day, decode(e.target.value)))}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium"
            >
              {sessions.map((s) => (
                <option key={s.id} value={`session:${s.id}`}>
                  {s.name}
                </option>
              ))}
              <option value={current.kind === 'zone2' ? encode(current) : 'zone2:30'}>
                Off + zone 2 ({current.kind === 'zone2' ? current.minutes : 30} min)
              </option>
              <option value="walk">Off + long walk</option>
              <option value="rest">Rest</option>
            </select>
          </li>
        )
      })}
    </ul>
  )
}
