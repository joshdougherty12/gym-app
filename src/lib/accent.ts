import type { AccentPref } from '../types'

export const ACCENTS: { value: AccentPref; label: string }[] = [
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Barbie pink' },
  { value: 'olive', label: 'Olive drab' },
]

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

/** The accent to show: the one picked in Settings, else Barbie pink on Sophie's phone, olive drab on Joshua's, orange for everyone else. */
export function resolveAccent(pref: AccentPref | undefined, role: 'sophie' | 'joshua' | null): AccentPref {
  if (pref) return pref
  return role === 'sophie' ? 'pink' : role === 'joshua' ? 'olive' : 'orange'
}
