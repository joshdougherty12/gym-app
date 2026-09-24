import type { ActiveWorkout, CardioLog, DailyLog, Exercise, Measurement, PhotoAngle, SessionTemplate, WeekOverride, WeeklyReview, WorkoutLog } from '../types'
import { db as defaultDb, type CutlineDB, type SettingsRow } from './db'

export interface BackupPhoto {
  id: string
  date: string
  angle: PhotoAngle
  type: string
  base64: string
}

export interface Backup {
  app: 'cutline'
  exportedAt: string
  schemaVersion: number
  settings: SettingsRow[]
  exercises: Exercise[]
  sessions: SessionTemplate[]
  weekOverrides: WeekOverride[]
  workouts: WorkoutLog[]
  activeWorkout: ActiveWorkout[]
  dailyLogs: DailyLog[]
  cardio: CardioLog[]
  measurements: Measurement[]
  weeklyReviews: WeeklyReview[]
  photos?: BackupPhoto[]
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export async function buildBackup(includePhotos: boolean, d: CutlineDB = defaultDb): Promise<Backup> {
  const backup: Backup = {
    app: 'cutline',
    exportedAt: new Date().toISOString(),
    schemaVersion: d.verno,
    settings: await d.settings.toArray(),
    exercises: await d.exercises.toArray(),
    sessions: await d.sessions.toArray(),
    weekOverrides: await d.weekOverrides.toArray(),
    workouts: await d.workouts.toArray(),
    activeWorkout: await d.activeWorkout.toArray(),
    dailyLogs: await d.dailyLogs.toArray(),
    cardio: await d.cardio.toArray(),
    measurements: await d.measurements.toArray(),
    weeklyReviews: await d.weeklyReviews.toArray(),
  }
  if (includePhotos) {
    backup.photos = []
    for (const p of await d.photos.toArray()) {
      backup.photos.push({ id: p.id, date: p.date, angle: p.angle, type: p.blob.type || 'image/jpeg', base64: toBase64(new Uint8Array(await p.blob.arrayBuffer())) })
    }
  }
  return backup
}

const ARRAYS = ['settings', 'exercises', 'sessions', 'weekOverrides', 'workouts', 'activeWorkout', 'dailyLogs', 'cardio', 'measurements', 'weeklyReviews'] as const

/** Check that parsed JSON is a Cutline backup; throws with a readable message if not. */
export function parseBackup(json: unknown): Backup {
  if (typeof json !== 'object' || json === null) throw new Error('Not a JSON object.')
  const o = json as Record<string, unknown>
  if (o.app !== 'cutline') throw new Error('This file is not a Cutline backup.')
  for (const k of ARRAYS) if (!Array.isArray(o[k])) throw new Error(`Backup is missing "${k}".`)
  if (o.photos !== undefined && !Array.isArray(o.photos)) throw new Error('Backup "photos" is not a list.')
  if (typeof o.schemaVersion === 'number' && o.schemaVersion > defaultDb.verno) throw new Error('This backup is from a newer version of the app. Update the app first.')
  return o as unknown as Backup
}

/**
 * Replace everything with the backup's contents, in one transaction. Photos
 * are replaced only when the backup includes them; otherwise current photos
 * are kept.
 */
export async function restoreBackup(b: Backup, d: CutlineDB = defaultDb): Promise<void> {
  const photos = b.photos?.map((p) => ({ id: p.id, date: p.date, angle: p.angle, blob: new Blob([fromBase64(p.base64)], { type: p.type }) }))
  const tables = [d.settings, d.exercises, d.sessions, d.weekOverrides, d.workouts, d.activeWorkout, d.dailyLogs, d.cardio, d.measurements, d.weeklyReviews, d.photos]
  await d.transaction('rw', tables, async () => {
    await Promise.all([
      d.settings.clear().then(() => d.settings.bulkPut(b.settings)),
      d.exercises.clear().then(() => d.exercises.bulkPut(b.exercises)),
      d.sessions.clear().then(() => d.sessions.bulkPut(b.sessions)),
      d.weekOverrides.clear().then(() => d.weekOverrides.bulkPut(b.weekOverrides)),
      d.workouts.clear().then(() => d.workouts.bulkPut(b.workouts)),
      d.activeWorkout.clear().then(() => d.activeWorkout.bulkPut(b.activeWorkout)),
      d.dailyLogs.clear().then(() => d.dailyLogs.bulkPut(b.dailyLogs)),
      d.cardio.clear().then(() => d.cardio.bulkPut(b.cardio)),
      d.measurements.clear().then(() => d.measurements.bulkPut(b.measurements)),
      d.weeklyReviews.clear().then(() => d.weeklyReviews.bulkPut(b.weeklyReviews)),
      photos ? d.photos.clear().then(() => d.photos.bulkPut(photos)) : Promise.resolve(),
    ])
  })
}

export async function downloadBackup(includePhotos: boolean): Promise<void> {
  const b = await buildBackup(includePhotos)
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cutline-backup-${new Date().toISOString().slice(0, 10)}${includePhotos ? '-with-photos' : ''}.json`
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importBackupFile(file: File): Promise<void> {
  const text = await file.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  await restoreBackup(parseBackup(json))
}
