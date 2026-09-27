import Dexie, { type EntityTable } from 'dexie'
import { EXERCISE_LIBRARY } from '../data/exercises'
import { applySwaps, SESSION_TEMPLATES } from '../data/program'
import type {
  ActiveWorkout,
  AiCacheRow,
  CardioLog,
  DailyLog,
  Exercise,
  GroceryItem,
  Meal,
  Measurement,
  PartnerLinkRow,
  PartnerRecordRow,
  Photo,
  Recipe,
  SecretRow,
  SessionTemplate,
  Settings,
  StepDay,
  SyncMetaRow,
  SyncOutboxRow,
  WeekOverride,
  WeeklyReview,
  WorkoutLog,
} from '../types'
import { defaultSettings } from './defaults'
import { newId } from '../lib/id'
import { splitLegacyPlan } from '../lib/kitchen'

export type SettingsRow = Settings & { id: 'app' }

/** aiCache row holding the week plan. */
export const WEEKPLAN_ID = 'weekplan'

// Kept from the app's old name (Cutline): renaming the database would orphan existing data.
export const DB_NAME = 'cutline'

export class CutlineDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  sessions!: EntityTable<SessionTemplate, 'id'>
  weekOverrides!: EntityTable<WeekOverride, 'weekNumber'>
  workouts!: EntityTable<WorkoutLog, 'id'>
  activeWorkout!: EntityTable<ActiveWorkout, 'id'>
  dailyLogs!: EntityTable<DailyLog, 'date'>
  cardio!: EntityTable<CardioLog, 'id'>
  measurements!: EntityTable<Measurement, 'date'>
  photos!: EntityTable<Photo, 'id'>
  weeklyReviews!: EntityTable<WeeklyReview, 'weekNumber'>
  meals!: EntityTable<Meal, 'id'>
  aiCache!: EntityTable<AiCacheRow, 'id'>
  secrets!: EntityTable<SecretRow, 'id'>
  recipes!: EntityTable<Recipe, 'id'>
  groceryItems!: EntityTable<GroceryItem, 'id'>
  partner!: EntityTable<PartnerLinkRow, 'id'>
  syncOutbox!: EntityTable<SyncOutboxRow, 'key'>
  syncMeta!: EntityTable<SyncMetaRow, 'key'>
  partnerRecords!: EntityTable<PartnerRecordRow, 'key'>
  steps!: EntityTable<StepDay, 'date'>

  constructor(name = DB_NAME) {
    super(name)

    // Schema history. Never edit a released version: add a new
    // this.version(n + 1).stores({...}).upgrade(tx => ...) instead.
    // Only indexed fields are listed; everything else is stored as-is.
    this.version(1).stores({
      settings: 'id',
      exercises: 'id, pattern',
      sessions: 'id',
      weekOverrides: 'weekNumber',
      workouts: 'id, date, weekNumber, sessionTemplateId, [sessionTemplateId+date]',
      activeWorkout: 'id',
      dailyLogs: 'date',
      cardio: 'id, date, kind',
      measurements: 'date',
      photos: 'id, date, angle',
      weeklyReviews: 'weekNumber',
    })

    // v2: meal logging (photo estimates), cached AI ideas and plans, and a
    // secrets table for the API key. Adds tables only; existing data untouched.
    this.version(2).stores({
      meals: 'id, date, mealType',
      aiCache: 'id',
      secrets: 'id',
    })

    // v3: joint-friendly program (bad low back, patellar tendonitis). Only
    // slots that still hold the original exercise change; logs are untouched.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const table = tx.table<SessionTemplate, string>('sessions')
        const updated = applySwaps(await table.toArray())
        await table.bulkPut(updated)
      })

    // v4: recipes saved from Claude's suggestions. Adds a table only.
    this.version(4).stores({
      recipes: 'id, savedAt',
    })

    // v5: partner link. Grocery items become their own rows (so two people can
    // check items off at once), plus the link, the sync outbox, sync timestamps
    // and records that exist only in sync (partner profile, workout summaries,
    // high-fives). A saved week plan's grocery list moves into the new table.
    this.version(5)
      .stores({
        groceryItems: 'id, listId',
        partner: 'id',
        syncOutbox: 'key, nextAttemptAt',
        syncMeta: 'key',
        partnerRecords: 'key, type, by',
      })
      .upgrade(async (tx) => {
        const cache = tx.table<AiCacheRow, string>('aiCache')
        const row = await cache.get(WEEKPLAN_ID)
        if (!row) return
        // Random ids: two phones that migrate and then link must not collide.
        const listId = newId('list')
        const split = splitLegacyPlan(row.data, listId, (n) => `${listId}-${n}`)
        if (!split) return
        await tx.table<GroceryItem, string>('groceryItems').bulkPut(split.items)
        await cache.put({ ...row, data: split.plan })
      })

    // v6: steps counted by the phone or imported from Apple Health, one row per
    // day. The day's log keeps the steps everything reads, now with a source;
    // every step count logged before this was typed in.
    this.version(6)
      .stores({ steps: 'date' })
      .upgrade(async (tx) => {
        await tx
          .table<DailyLog, string>('dailyLogs')
          .toCollection()
          .modify((log) => {
            if (log.steps !== undefined && log.stepsSource === undefined) log.stepsSource = 'manual'
          })
      })

    this.on('populate', (tx) => {
      void tx.table('settings').add({ id: 'app', ...defaultSettings() } satisfies SettingsRow)
      void tx.table('exercises').bulkAdd(structuredClone([...EXERCISE_LIBRARY]))
      void tx.table('sessions').bulkAdd(structuredClone([...SESSION_TEMPLATES]))
    })

    // New library exercises shipped in a later version are added; exercises
    // already stored (and any edits to them) are never overwritten.
    this.on('ready', async (db) => {
      const table = (db as CutlineDB).exercises
      const have = new Set(await table.toCollection().primaryKeys())
      const missing = EXERCISE_LIBRARY.filter((e) => !have.has(e.id))
      if (missing.length) await table.bulkAdd(structuredClone(missing))
    }, true) // sticky: also runs when the database is reopened
  }
}

/**
 * Demo mode uses a completely separate database, so previewing demo data can
 * never touch real logs. The flag is a per-browser convenience.
 */
export const DEMO_DB_NAME = 'cutline-demo'
const DEMO_KEY = 'cutline-demo-mode'

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === '1'
  } catch {
    return false
  }
}

export function setDemoFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEMO_KEY, '1')
    else localStorage.removeItem(DEMO_KEY)
  } catch {
    /* storage unavailable: demo mode cannot be entered */
  }
}

export const db = new CutlineDB(isDemoMode() ? DEMO_DB_NAME : DB_NAME)

// Outside demo mode, throw away any leftover demo database (left by "Exit demo").
if (!isDemoMode() && typeof indexedDB !== 'undefined') void Dexie.delete(DEMO_DB_NAME).catch(() => undefined)
