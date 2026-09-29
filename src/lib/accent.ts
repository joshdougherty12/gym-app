import type { AccentPref } from '../types'
import { SEASONS, seasonFor, type Season } from './seasons'

/** A concrete look: one of the fixed accents, or today's seasonal theme. */
export type ThemeId = Exclude<AccentPref, 'seasonal'> | Season

export const ACCENTS: { value: AccentPref; label: string }[] = [
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Barbie pink' },
  { value: 'olive', label: 'Olive drab' },
]

export function isSeason(t: ThemeId): t is Season {
  return (SEASONS as readonly string[]).includes(t)
}

/**
 * Joshua and Sophie's phones, told apart by the names on the partner link: a
 * phone named "Soph…" linked with "Jo…" is Sophie's, and the other way round
 * is Joshua's. Anyone else is null.
 */
export function coupleRole(myName: string | undefined, partnerName: string | undefined, linked: boolean): 'sophie' | 'joshua' | null {
  if (!linked) return null
  const me = (myName ?? '').trim()
  const them = (partnerName ?? '').trim()
  if (/^soph/i.test(me) && /^jo/i.test(them)) return 'sophie'
  if (/^jo/i.test(me) && /^soph/i.test(them)) return 'joshua'
  return null
}

/** The accent picked in Settings, else seasonal on Sophie's phone, olive drab on Joshua's, orange for everyone else. */
export function accentPref(pref: AccentPref | undefined, role: 'sophie' | 'joshua' | null): AccentPref {
  if (pref) return pref
  return role === 'sophie' ? 'seasonal' : role === 'joshua' ? 'olive' : 'orange'
}

/** The accents offered in Settings: the seasonal themes are Sophie's alone. */
export function accentChoices(role: 'sophie' | 'joshua' | null): { value: AccentPref; label: string }[] {
  return role === 'sophie' ? ACCENTS : ACCENTS.filter((a) => a.value !== 'seasonal')
}

/** The look to show today. Seasonal (hers only) follows the calendar, with her birthday. */
export function resolveAccent(pref: AccentPref | undefined, role: 'sophie' | 'joshua' | null, today: string): ThemeId {
  const p = accentPref(pref, role)
  if (p !== 'seasonal') return p
  return role === 'sophie' ? seasonFor(today, true) : 'orange'
}
