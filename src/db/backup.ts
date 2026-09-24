import { db } from './db'

/**
 * Everything except photos, as JSON. Import (and photos in the backup) come
 * in the polish phase; until then this is a safety copy.
 */
export async function exportJson(): Promise<Blob> {
  const data = {
    app: 'cutline',
    exportedAt: new Date().toISOString(),
    schemaVersion: db.verno,
    settings: await db.settings.toArray(),
    exercises: await db.exercises.toArray(),
    sessions: await db.sessions.toArray(),
    weekOverrides: await db.weekOverrides.toArray(),
    workouts: await db.workouts.toArray(),
    activeWorkout: await db.activeWorkout.toArray(),
    dailyLogs: await db.dailyLogs.toArray(),
    cardio: await db.cardio.toArray(),
    measurements: await db.measurements.toArray(),
    weeklyReviews: await db.weeklyReviews.toArray(),
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

export async function downloadBackup(): Promise<void> {
  const blob = await exportJson()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cutline-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
