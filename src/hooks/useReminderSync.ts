import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from '../db/db'
import { todayIso } from '../lib/dates'
import { syncReminders } from '../lib/native'
import { estimateMinutes, planReminders, REMINDER_ID_RANGE } from '../lib/reminders'
import type { SessionTemplate, Settings } from '../types'

/**
 * Keep the phone's scheduled reminders in step with the settings, schedule and
 * log: re-plans the next two weeks whenever any of them change (including
 * finishing today's workout, which drops tonight's nudge).
 */
export function useReminderSync(settings: Settings | undefined, sessions: SessionTemplate[] | undefined) {
  const today = todayIso()
  const finishedToday = useLiveQuery(async () => (await db.workouts.where('date').equals(today).toArray()).filter((w) => w.finishedAt !== undefined).length, [today])
  const key = settings && sessions ? JSON.stringify([settings.reminders, settings.schedule, sessions.map((s) => [s.id, s.name, s.slots.length]), finishedToday, today]) : null
  useEffect(() => {
    if (!key || !settings || !sessions) return
    const t = window.setTimeout(() => {
      const byId = new Map(sessions.map((s) => [s.id, s]))
      const list = planReminders({
        reminders: settings.reminders,
        schedule: settings.schedule,
        today,
        now: new Date(),
        sessionName: (id) => byId.get(id)?.short ?? 'Workout',
        sessionMinutes: (id) => estimateMinutes(byId.get(id)?.slots.length ?? 6),
        finishedDates: new Set(finishedToday ? [today] : []),
      })
      void syncReminders(list, REMINDER_ID_RANGE)
    }, 800)
    return () => window.clearTimeout(t)
    // key captures every input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
