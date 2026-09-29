import { db } from '../db/db'
import { todayIso } from '../lib/dates'
import { call, defaultDeps } from './api'

/**
 * Today's note from Joshua (Sophie's phone only). The notes live on the sync
 * server, which hands out only today's, so none are stored in the app ahead of
 * time. Today's is kept for the day so it shows offline after the first fetch.
 */

const KEY = 'daily-note'

interface Cached {
  day: string
  text: string
}

function cached(day: string): string | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cached | null
    return c && c.day === day && typeof c.text === 'string' ? c.text : null
  } catch {
    return null
  }
}

export async function todaysNote(): Promise<string | null> {
  const day = todayIso()
  const hit = cached(day)
  if (hit) return hit
  const link = await db.partner.get('link')
  if (!link || link.status !== 'linked' || !defaultDeps.baseUrl) return null
  try {
    const res = await call<{ date: string; text?: string }>(defaultDeps, link, 'GET', '/note')
    if (!res.text) return null
    try {
      localStorage.setItem(KEY, JSON.stringify({ day, text: res.text } satisfies Cached))
    } catch {
      /* not cached: fetched again next open */
    }
    return res.text
  } catch {
    return null // offline, or no note for this household
  }
}
