import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useSettings } from '../db/repo'
import { portionSplit, type PortionSplit } from '../lib/partner/portions'
import { ActivityRouteData, ActivitySummaryData, EventData, MemberData, StepsShareData, WorkoutSummaryData } from '../lib/partner/types'
import { routeShareable } from '../lib/partner/activityRoute'
import { syncKey } from './outbox'
import type { PartnerLinkRow, PartnerRecordRow } from '../types'
import { partnerAvailable } from './config'

export interface PartnerView {
  link: PartnerLinkRow | null
  /** The partner's profile, once their phone has synced. */
  partner: MemberData | null
  partnerId: string | null
  partnerName: string
}

/** The partner link as the UI needs it; undefined while loading. */
export function usePartner(): PartnerView | undefined {
  return useLiveQuery(async () => {
    if (!partnerAvailable()) return { link: null, partner: null, partnerId: null, partnerName: 'Partner' }
    const link = (await db.partner.get('link')) ?? null
    if (!link) return { link: null, partner: null, partnerId: null, partnerName: 'Partner' }
    const row = (await db.partnerRecords.where('type').equals('member').toArray()).find((r) => r.by !== link.memberId)
    const parsed = row ? MemberData.safeParse(row.data) : null
    const partner = parsed?.success ? parsed.data : null
    return { link, partner, partnerId: row?.by ?? null, partnerName: partner?.name || 'Partner' }
  }, [])
}

/** Suggested portions for a shared dish, when linked and the partner shares a calorie target. */
export function usePortions(): { split: PortionSplit; myName: string; theirName: string; myTarget: number; theirTarget: number } | null {
  const p = usePartner()
  const settings = useSettings()
  const theirTarget = p?.partner?.calorieTarget
  if (!p?.link || p.link.status !== 'linked' || !settings || !theirTarget) return null
  const myName = settings.partner.name.trim() || settings.profile?.name?.trim() || 'You'
  return { split: portionSplit(settings.calorieTarget, theirTarget), myName, theirName: p.partnerName, myTarget: settings.calorieTarget, theirTarget }
}

export interface PartnerWorkout {
  key: string
  id: string
  data: WorkoutSummaryData
}

/** The partner's shared workouts on or after a date, newest first. */
export function usePartnerWorkouts(since: string): PartnerWorkout[] | undefined {
  return useLiveQuery(async () => {
    const link = await db.partner.get('link')
    if (!link) return []
    const rows = await db.partnerRecords.where('type').equals('wsum').filter((r) => r.by !== link.memberId).toArray()
    return rows
      .flatMap((r) => {
        const d = WorkoutSummaryData.safeParse(r.data)
        return d.success && d.data.date >= since ? [{ key: r.key, id: r.id, data: d.data }] : []
      })
      .sort((a, b) => b.data.finishedAt - a.data.finishedAt)
  }, [since])
}

export interface PartnerActivity {
  key: string
  id: string
  data: ActivitySummaryData
}

/** The partner's shared runs, walks and rides on or after a date, newest first (summaries only: no route). */
export function usePartnerActivities(since: string): PartnerActivity[] | undefined {
  return useLiveQuery(async () => {
    const link = await db.partner.get('link')
    if (!link) return []
    const rows = await db.partnerRecords.where('type').equals('asum').filter((r) => r.by !== link.memberId).toArray()
    return rows
      .flatMap((r) => {
        const d = ActivitySummaryData.safeParse(r.data)
        return d.success && d.data.date >= since ? [{ key: r.key, id: r.id, data: d.data }] : []
      })
      .sort((a, b) => b.data.finishedAt - a.data.finishedAt)
  }, [since])
}

export interface InboxEvent {
  row: PartnerRecordRow
  data: EventData
}

const SHOW_FOR_MS = 3 * 24 * 3600 * 1000

/** Unhandled events from the partner of the given kinds (last three days), newest first. */
export function usePartnerInbox(kinds: readonly EventData['kind'][]): InboxEvent[] | undefined {
  const key = kinds.join(',')
  return useLiveQuery(async () => {
    const link = await db.partner.get('link')
    if (!link) return []
    const now = Date.now()
    const rows = await db.partnerRecords.where('type').equals('event').filter((r) => r.by !== link.memberId && !r.seen).toArray()
    return rows
      .flatMap((row) => {
        const d = EventData.safeParse(row.data)
        return d.success && key.split(',').includes(d.data.kind) && now - d.data.at < SHOW_FOR_MS ? [{ row, data: d.data }] : []
      })
      .sort((a, b) => b.data.at - a.data.at)
  }, [key])
}

/** The partner's shared step count for `date`, if they share steps and have synced that day. */
export function usePartnerSteps(date: string): StepsShareData | null | undefined {
  return useLiveQuery(async () => {
    const link = await db.partner.get('link')
    if (!link) return null
    const row = (await db.partnerRecords.where('type').equals('steps').toArray()).find((r) => r.by !== link.memberId)
    const d = row ? StepsShareData.safeParse(row.data) : null
    return d?.success && d.data.date === date ? d.data : null
  }, [date])
}

export interface PartnerActivityDetail {
  summary: ActivitySummaryData
  /** Present only while the partner shares routes and the activity is from the last 30 days. */
  route: ActivityRouteData | null
}

/** One of the partner's shared activities, with its route when shared; null if it isn't (or is no longer) shared. */
export function usePartnerActivity(id: string): PartnerActivityDetail | null | undefined {
  return useLiveQuery(async () => {
    const link = await db.partner.get('link')
    if (!link) return null
    const [s, r] = await Promise.all([db.partnerRecords.get(syncKey('asum', id)), db.partnerRecords.get(syncKey('aroute', id))])
    if (!s || s.by === link.memberId) return null
    const summary = ActivitySummaryData.safeParse(s.data)
    if (!summary.success) return null
    const route = r && r.by !== link.memberId ? ActivityRouteData.safeParse(r.data) : null
    return { summary: summary.data, route: route?.success && routeShareable(route.data) ? route.data : null }
  }, [id])
}

/** Whether this phone's own activity route is currently shared with the partner. */
export function useOwnRouteShared(id: string): boolean | undefined {
  return useLiveQuery(async () => {
    const link = await db.partner.get('link')
    if (!link || link.status !== 'linked') return false
    const r = await db.partnerRecords.get(syncKey('aroute', id))
    return !!r && r.by === link.memberId
  }, [id])
}
