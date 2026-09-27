import { db as defaultDb, WEEKPLAN_ID, type CutlineDB } from '../db/db'
import { getSettings } from '../db/repo'
import { addDays, todayIso } from '../lib/dates'
import { newId } from '../lib/id'
import type { WeekPlan } from '../lib/kitchen'
import { b64url, deriveKeys, openRecord, randomBytes, randomId, sealRecord, type HouseholdKeys, type SealedRecord } from '../lib/partner/crypto'
import { dueEntries, failed, shouldApply } from '../lib/partner/merge'
import { decodeLinkCode, encodeLinkCode } from '../lib/partner/pairing'
import { ActivitySummaryData, EventData, GroceryItemData, MemberData, PlanData, RecipeData, StepsShareData, WorkoutSummaryData, type RecordType } from '../lib/partner/types'
import { shouldPublishSteps } from '../lib/steps'
import { workoutSummary } from '../lib/partner/summary'
import { activitySummary } from '../lib/partner/activitySummary'
import { sameRecipe } from '../lib/recipes'
import type { Activity, PartnerLinkRow, PartnerRecordRow, Settings, WorkoutLog } from '../types'
import { call, defaultDeps, isGone, SyncHttpError, SyncOfflineError, type SyncDeps } from './api'
import { markChanged, syncKey } from './outbox'

// ---- Record codecs: how each shared type is read from and written to this phone ----

interface Codec {
  /** Current local value, or undefined if deleted. Only records this phone may send. */
  read(d: CutlineDB, id: string, me: string): Promise<unknown>
  /** Apply a pulled value; null deletes. */
  write(d: CutlineDB, id: string, data: unknown, by: string, ts: number): Promise<void>
}

const stripId = <T extends { id: string }>(row: T | undefined) => {
  if (!row) return undefined
  const { id: _id, ...rest } = row
  return rest
}

const syncOnlyCodec = (type: PartnerRecordRow['type'], parse: (x: unknown) => unknown): Codec => ({
  async read(d, id, me) {
    const row = await d.partnerRecords.get(syncKey(type, id))
    // Only this phone's own records are ever sent.
    return row && row.by === me ? row.data : undefined
  },
  async write(d, id, data, by, ts) {
    const key = syncKey(type, id)
    if (data === null) return void (await d.partnerRecords.delete(key))
    const cur = await d.partnerRecords.get(key)
    await d.partnerRecords.put({ key, type, id, by, ts, data: parse(data), ...(cur?.seen ? { seen: true } : {}), ...(cur?.notified ? { notified: true } : {}) })
  },
})

const CODECS: Record<RecordType, Codec> = {
  recipe: {
    read: async (d, id) => stripId(await d.recipes.get(id)),
    async write(d, id, data) {
      if (data === null) await d.recipes.delete(id)
      else await d.recipes.put({ ...RecipeData.parse(data), id })
    },
  },
  grocery: {
    read: async (d, id) => stripId(await d.groceryItems.get(id)),
    async write(d, id, data) {
      if (data === null) await d.groceryItems.delete(id)
      else await d.groceryItems.put({ ...GroceryItemData.parse(data), id })
    },
  },
  plan: {
    async read(d, id) {
      if (id !== 'current') return undefined
      return (await d.aiCache.get(WEEKPLAN_ID))?.data
    },
    async write(d, id, data) {
      if (id !== 'current' || data === null) return
      const plan = PlanData.parse(data) as unknown as WeekPlan
      await d.aiCache.put({ id: WEEKPLAN_ID, createdAt: Date.now(), data: plan })
    },
  },
  member: syncOnlyCodec('member', (x) => MemberData.parse(x)),
  wsum: syncOnlyCodec('wsum', (x) => WorkoutSummaryData.parse(x)),
  event: syncOnlyCodec('event', (x) => EventData.parse(x)),
  steps: syncOnlyCodec('steps', (x) => StepsShareData.parse(x)),
  asum: syncOnlyCodec('asum', (x) => ActivitySummaryData.parse(x)),
}

const isRecordType = (t: string): t is RecordType => t in CODECS

// ---- Keys ----

const keyCache = new Map<string, Promise<HouseholdKeys>>()
function keysFor(link: Pick<PartnerLinkRow, 'householdId' | 'rootKey'>): Promise<HouseholdKeys> {
  const k = `${link.householdId}:${link.rootKey}`
  let p = keyCache.get(k)
  if (!p) {
    p = deriveKeys(b64url.decode(link.rootKey))
    keyCache.set(k, p)
  }
  return p
}

export async function getLink(d: CutlineDB = defaultDb): Promise<PartnerLinkRow | undefined> {
  return d.partner.get('link')
}

/** The code to show while waiting for the partner to join. */
export function linkCodeFor(link: PartnerLinkRow): string {
  return encodeLinkCode({ householdId: link.householdId, secret: link.secret, rootKey: link.rootKey })
}

// ---- Own records (member profile, workout summaries, events) ----

/** Write one of this phone's own sync-only records and queue it, if it changed. */
async function putOwn(d: CutlineDB, link: PartnerLinkRow, type: PartnerRecordRow['type'], id: string, data: unknown): Promise<void> {
  const key = syncKey(type, id)
  const cur = await d.partnerRecords.get(key)
  if (cur && JSON.stringify(cur.data) === JSON.stringify(data)) return
  await d.partnerRecords.put({ key, type, id, by: link.memberId, ts: Date.now(), data, seen: true })
  await markChanged(type, id, d)
}

async function deleteOwn(d: CutlineDB, type: PartnerRecordRow['type'], ids: string[]): Promise<void> {
  if (!ids.length) return
  await d.partnerRecords.bulkDelete(ids.map((id) => syncKey(type, id)))
  await markChanged(type, ids, d)
}

export function memberFromSettings(s: Settings): MemberData {
  const name = (s.partner.name.trim() || s.profile?.name?.trim() || '').slice(0, 60)
  return { name, sharesWorkouts: s.partner.shareWorkouts, sharesActivities: s.partner.shareActivities, ...(s.partner.shareCalorieTarget ? { calorieTarget: s.calorieTarget } : {}) }
}

/** Keep this phone's member record in step with its settings; withdraw workout or activity summaries when their sharing is turned off. */
export async function refreshOwnRecords(d: CutlineDB = defaultDb): Promise<void> {
  const link = await getLink(d)
  if (!link) return
  const s = await getSettings(d)
  await putOwn(d, link, 'member', link.memberId, memberFromSettings(s))
  if (!s.partner.shareWorkouts) {
    const mine = await d.partnerRecords.where('type').equals('wsum').filter((r) => r.by === link.memberId).toArray()
    await deleteOwn(d, 'wsum', mine.map((r) => r.id))
  }
  if (!s.partner.shareActivities) {
    const acts = await d.partnerRecords.where('type').equals('asum').filter((r) => r.by === link.memberId).toArray()
    await deleteOwn(d, 'asum', acts.map((r) => r.id))
  }
  await refreshOwnSteps(d, link, s)
}

/** Share today's steps (one record per member, id = member id) when sharing is on; withdraw it when off. */
async function refreshOwnSteps(d: CutlineDB, link: PartnerLinkRow, s: Settings, now = Date.now()): Promise<void> {
  const key = syncKey('steps', link.memberId)
  const cur = await d.partnerRecords.get(key)
  if (!s.partner.shareSteps) {
    if (cur) await deleteOwn(d, 'steps', [link.memberId])
    return
  }
  const today = todayIso()
  const steps = (await d.dailyLogs.get(today))?.steps
  if (steps === undefined) return
  const prev = cur ? StepsShareData.safeParse(cur.data) : null
  const next = { date: today, steps: Math.min(100_000, Math.max(0, Math.round(steps))) }
  if (!shouldPublishSteps(prev?.success ? prev.data : undefined, next, now)) return
  await putOwn(d, link, 'steps', link.memberId, { ...next, at: now })
}

/** Share a finished workout as a summary (when linked and sharing is on). */
export async function publishWorkout(log: WorkoutLog, d: CutlineDB = defaultDb): Promise<void> {
  const link = await getLink(d)
  if (!link || log.finishedAt === undefined) return
  const s = await getSettings(d)
  if (!s.partner.shareWorkouts) return
  const [workouts, exercises, session] = await Promise.all([d.workouts.toArray(), d.exercises.toArray(), d.sessions.get(log.sessionTemplateId)])
  const earlier = workouts.filter((w) => w.id !== log.id && (w.date < log.date || (w.date === log.date && w.startedAt < log.startedAt)))
  const summary = workoutSummary(log, earlier, new Map(exercises.map((e) => [e.id, e])), session?.name ?? 'Workout')
  await putOwn(d, link, 'wsum', log.id, summary)
}

/** Share a finished GPS activity as a summary (type, date, distance, time, pace; never the route) when linked and sharing activities. */
export async function publishActivity(a: Activity, d: CutlineDB = defaultDb): Promise<void> {
  const link = await getLink(d)
  if (!link) return
  const s = await getSettings(d)
  if (!s.partner.shareActivities) return
  await putOwn(d, link, 'asum', a.id, activitySummary(a))
}

/** Withdraw a deleted activity's summary. */
export async function withdrawActivity(id: string, d: CutlineDB = defaultDb): Promise<void> {
  const link = await getLink(d)
  if (!link) return
  const row = await d.partnerRecords.get(syncKey('asum', id))
  if (row && row.by === link.memberId) await deleteOwn(d, 'asum', [id])
}

/** Send a high-five, a nudge or "I ate this". */
export async function sendEvent(data: EventData, d: CutlineDB = defaultDb): Promise<boolean> {
  const link = await getLink(d)
  if (!link || link.status !== 'linked') return false
  await putOwn(d, link, 'event', newId('ev'), data)
  return true
}

const EVENT_TTL_MS = 14 * 24 * 3600 * 1000

/** Delete events older than two weeks: own ones for both phones, the partner's on this phone. */
async function pruneEvents(d: CutlineDB, link: PartnerLinkRow, now: number): Promise<void> {
  const old = await d.partnerRecords
    .where('type')
    .equals('event')
    .filter((r) => now - ((r.data as { at?: number }).at ?? r.ts) > EVENT_TTL_MS)
    .toArray()
  const mine = old.filter((r) => r.by === link.memberId).map((r) => r.id)
  const theirs = old.filter((r) => r.by !== link.memberId).map((r) => r.key)
  await deleteOwn(d, 'event', mine)
  if (theirs.length) {
    await d.partnerRecords.bulkDelete(theirs)
    await d.syncMeta.bulkDelete(theirs)
  }
}

// ---- Linking ----

export class LinkError extends Error {}

/** Everything shared from this phone when it links: the kitchen (optionally without the plan), its profile and this week's workouts. */
async function queueInitial(d: CutlineDB, withPlan: boolean): Promise<void> {
  const synced = new Set((await d.syncMeta.toCollection().primaryKeys()).map(String))
  const recipes = await d.recipes.toArray()
  const syncedRecipes = recipes.filter((r) => synced.has(syncKey('recipe', r.id)))
  const local = recipes.filter((r) => !synced.has(syncKey('recipe', r.id)))
  // The same recipe saved on both phones: keep the household's copy.
  const dupes = local.filter((r) => syncedRecipes.some((x) => sameRecipe(x.name, r.name)))
  if (dupes.length) await d.recipes.bulkDelete(dupes.map((r) => r.id))
  await markChanged('recipe', local.filter((r) => !dupes.includes(r)).map((r) => r.id), d)
  if (withPlan) {
    if (await d.aiCache.get(WEEKPLAN_ID)) await markChanged('plan', 'current', d)
    await markChanged('grocery', (await d.groceryItems.toCollection().primaryKeys()).map(String), d)
  }
  await refreshOwnRecords(d)
  const weekAgo = addDays(todayIso(), -7)
  for (const w of await d.workouts.where('date').aboveOrEqual(weekAgo).toArray()) await publishWorkout(w, d)
  for (const a of await d.activities.where('date').aboveOrEqual(weekAgo).toArray()) await publishActivity(a, d)
}

/** Partner A: create the household and return the link code to show. */
export async function createHousehold(d: CutlineDB = defaultDb, deps: SyncDeps = defaultDeps): Promise<string> {
  if (await getLink(d)) throw new LinkError('This phone is already linked.')
  const link: PartnerLinkRow = {
    id: 'link',
    householdId: randomId(),
    secret: b64url.encode(randomBytes(32)),
    rootKey: b64url.encode(randomBytes(32)),
    memberId: randomId(),
    role: 'creator',
    status: 'waiting',
    createdAt: Date.now(),
    cursor: 0,
  }
  await call(deps, link, 'POST', '')
  await d.partner.put(link)
  await queueInitial(d, true)
  return linkCodeFor(link)
}

/** Partner B: join with a code. The household's week plan replaces this phone's; saved recipes are combined. */
export async function joinHousehold(code: string, d: CutlineDB = defaultDb, deps: SyncDeps = defaultDeps): Promise<void> {
  if (await getLink(d)) throw new LinkError('This phone is already linked. Unlink it first in Settings → Partner.')
  const parts = decodeLinkCode(code)
  const memberId = randomId()
  try {
    await call(deps, { ...parts, memberId }, 'POST', '/join')
  } catch (e) {
    if (e instanceof SyncHttpError) {
      if (e.code === 'household_full') throw new LinkError('That household already has two people. Ask your partner to unlink and link again.')
      if (e.status === 404 || e.status === 410) throw new LinkError('That link was canceled. Ask your partner for a new one.')
      if (e.status === 401) throw new LinkError('That code does not match. Copy it again.')
      if (e.status === 429) throw new LinkError('Too many tries. Wait a minute and try again.')
    }
    if (e instanceof SyncOfflineError) throw new LinkError('Could not reach the sync server. Check the connection and try again.')
    throw e
  }
  const link: PartnerLinkRow = { id: 'link', ...parts, memberId, role: 'joiner', status: 'linked', createdAt: Date.now(), cursor: 0 }
  await d.partner.put(link)
  // Take the household's kitchen first, then add what only this phone has.
  await pull(d, deps, link, await keysFor(link))
  const hasPlan = !!(await d.syncMeta.get(syncKey('plan', 'current')))
  // The household's list replaces this phone's own list.
  if (hasPlan) await collectOrphanItems(d, true)
  await queueInitial(d, !hasPlan)
}

/** Stop sharing on this phone: forget the link and the partner's records; keep the kitchen. */
export async function forgetLink(d: CutlineDB = defaultDb): Promise<void> {
  await d.transaction('rw', [d.partner, d.syncOutbox, d.syncMeta, d.partnerRecords], async () => {
    await d.partner.clear()
    await d.syncOutbox.clear()
    await d.syncMeta.clear()
    await d.partnerRecords.clear()
  })
}

/**
 * Unlink: the server deletes the household, so sharing stops for both phones.
 * With `thisPhoneOnly`, forget the link here even if the server can't be reached.
 */
export async function unlink(d: CutlineDB = defaultDb, deps: SyncDeps = defaultDeps, thisPhoneOnly = false): Promise<void> {
  const link = await getLink(d)
  if (!link) return
  try {
    await call(deps, link, 'DELETE', '')
  } catch (e) {
    if (!(isGone(e) || thisPhoneOnly)) throw e
  }
  await forgetLink(d)
}

// ---- Sync ----

export interface SyncResult {
  state: 'off' | 'synced' | 'pending' | 'offline' | 'gone' | 'error'
  /** New events from the partner (for notifications). */
  newEvents: PartnerRecordRow[]
  pending: number
}

const MAX_BATCH_CHARS = 400_000
const MAX_RECORD_CHARS = 60_000

async function push(d: CutlineDB, deps: SyncDeps, link: PartnerLinkRow, keys: HouseholdKeys): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const now = Date.now()
    const due = dueEntries(await d.syncOutbox.toArray(), now, 100)
    if (!due.length) return
    const batch: { key: string; sealed: SealedRecord }[] = []
    let chars = 0
    for (const e of due) {
      if (!isRecordType(e.type)) {
        await d.syncOutbox.delete(e.key)
        continue
      }
      const meta = await d.syncMeta.get(e.key)
      const ts = meta?.ts ?? now
      if (!meta) await d.syncMeta.put({ key: e.key, ts })
      const data = await CODECS[e.type].read(d, e.id, link.memberId)
      const sealed = await sealRecord(keys, link.householdId, { t: e.type, i: e.id, d: data ?? null, by: link.memberId }, ts)
      // Too big to share (a huge recipe): leave it on this phone only.
      if (sealed.data.length > MAX_RECORD_CHARS) {
        await d.syncOutbox.delete(e.key)
        continue
      }
      if (chars + sealed.data.length > MAX_BATCH_CHARS && batch.length) break
      chars += sealed.data.length
      batch.push({ key: e.key, sealed })
    }
    if (!batch.length) continue
    try {
      await call(deps, link, 'POST', '/push', { records: batch.map((b) => b.sealed) })
    } catch (e) {
      if (isGone(e)) throw e
      // Offline or the server is busy: try these again later.
      const t = Date.now()
      await d.syncOutbox.bulkPut(due.filter((x) => batch.some((b) => b.key === x.key)).map((x) => failed(x, t)))
      throw e
    }
    // Accepted, or stale (the server already has something newer, which the pull brings).
    for (const b of batch) {
      const meta = await d.syncMeta.get(b.key)
      if (meta?.ts === b.sealed.ts) await d.syncOutbox.delete(b.key)
    }
  }
}

interface Pulled {
  rid: string
  v: number
  ts: number
  data: string
}

async function pull(d: CutlineDB, deps: SyncDeps, link: PartnerLinkRow, keys: HouseholdKeys): Promise<PartnerRecordRow[]> {
  let cursor = link.cursor
  const fresh: PartnerRecordRow[] = []
  let seen: Set<string> | null = null
  for (let page = 0; page < 200; page++) {
    const res = await call<{ records: Pulled[]; cursor: number; more: boolean; reset: boolean }>(deps, link, 'GET', `/changes?since=${cursor}&limit=200`)
    if (res.reset && !seen) seen = new Set()
    for (const r of res.records) {
      let env
      try {
        env = await openRecord(keys, link.householdId, r)
      } catch {
        continue // Not readable with this key: skip it.
      }
      if (!isRecordType(env.t)) continue
      const key = syncKey(env.t, env.i)
      seen?.add(key)
      const local = await d.syncMeta.get(key)
      const apply = shouldApply(local?.ts, r.ts) && !(local?.ts === r.ts && env.by === link.memberId)
      if (!apply) continue
      try {
        await CODECS[env.t].write(d, env.i, env.d, env.by, r.ts)
      } catch {
        continue // Malformed data from the other phone: ignore it.
      }
      await d.syncMeta.put({ key, ts: r.ts })
      await d.syncOutbox.delete(key)
      if (env.t === 'event' && env.by !== link.memberId && env.d !== null) {
        const row = await d.partnerRecords.get(key)
        if (row && !row.seen) fresh.push(row)
      }
    }
    cursor = res.cursor
    await d.partner.update('link', { cursor })
    if (!res.more) break
  }
  if (seen) await dropMissing(d, seen)
  return fresh
}

/** After a full resync: records this phone has synced before that the household no longer has were deleted. */
async function dropMissing(d: CutlineDB, seen: Set<string>): Promise<void> {
  const pending = new Set((await d.syncOutbox.toCollection().primaryKeys()).map(String))
  for (const m of await d.syncMeta.toArray()) {
    if (seen.has(m.key) || pending.has(m.key)) continue
    const i = m.key.indexOf(':')
    const type = m.key.slice(0, i)
    if (isRecordType(type) && type !== 'plan') await CODECS[type].write(d, m.key.slice(i + 1), null, '', m.ts)
    await d.syncMeta.delete(m.key)
  }
}

/**
 * Grocery rows that belong to no current list (the partner replaced the plan)
 * are removed from this phone. Only rows that came through sync are touched,
 * unless `includeLocal` (joining: this phone's own list was replaced).
 */
async function collectOrphanItems(d: CutlineDB, includeLocal = false): Promise<void> {
  const plan = (await d.aiCache.get(WEEKPLAN_ID))?.data as WeekPlan | undefined
  const listId = plan?.grocery?.listId
  const planTs = (await d.syncMeta.get(syncKey('plan', 'current')))?.ts ?? 0
  const pending = new Set((await d.syncOutbox.toCollection().primaryKeys()).map(String))
  const orphans: string[] = []
  for (const it of await d.groceryItems.toArray()) {
    if (it.listId === listId) continue
    const key = syncKey('grocery', it.id)
    if (pending.has(key)) continue
    const meta = await d.syncMeta.get(key)
    if (!meta && !includeLocal) continue
    // Newer than the plan: probably the next list whose plan has not arrived yet.
    if ((meta?.ts ?? 0) > planTs) continue
    orphans.push(it.id)
  }
  if (orphans.length) await d.groceryItems.bulkDelete(orphans)
}

/** One full sync: push what changed here, then pull what changed there. */
export async function syncOnce(d: CutlineDB = defaultDb, deps: SyncDeps = defaultDeps): Promise<SyncResult> {
  let link = await getLink(d)
  if (!link || !deps.baseUrl) return { state: 'off', newEvents: [], pending: 0 }
  const keys = await keysFor(link)
  try {
    if (link.status === 'waiting') {
      const info = await call<{ members: number }>(deps, link, 'GET', '')
      if (info.members >= 2) {
        await d.partner.update('link', { status: 'linked' })
        link = { ...link, status: 'linked' }
      }
    }
    await refreshOwnRecords(d)
    await pruneEvents(d, link, Date.now())
    await push(d, deps, link, keys)
    const newEvents = await pull(d, deps, (await getLink(d)) ?? link, keys)
    await collectOrphanItems(d)
    await d.partner.update('link', { lastSyncAt: Date.now() })
    const pending = await d.syncOutbox.count()
    return { state: pending ? 'pending' : 'synced', newEvents, pending }
  } catch (e) {
    if (isGone(e)) {
      await forgetLink(d)
      return { state: 'gone', newEvents: [], pending: 0 }
    }
    const pending = await d.syncOutbox.count()
    if (e instanceof SyncOfflineError || (e instanceof SyncHttpError && (e.status >= 500 || e.status === 429))) return { state: 'offline', newEvents: [], pending }
    return { state: 'error', newEvents: [], pending }
  }
}

/** After restoring a backup while linked: pull the household's kitchen again from the start. */
export async function resyncFromScratch(d: CutlineDB = defaultDb): Promise<void> {
  if (!(await getLink(d))) return
  await d.transaction('rw', d.partner, d.syncMeta, d.syncOutbox, async () => {
    await d.partner.update('link', { cursor: 0 })
    await d.syncMeta.clear()
    await d.syncOutbox.clear()
  })
}

export async function markEventSeen(key: string, d: CutlineDB = defaultDb): Promise<void> {
  await d.partnerRecords.update(key, { seen: true })
}
