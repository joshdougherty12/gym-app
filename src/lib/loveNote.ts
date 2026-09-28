import { coupleRole } from './accent'

/** Joshua's note to Sophie shows only on her phone (see coupleRole). */
export function isLoveNotePhone(myName: string | undefined, partnerName: string | undefined, linked: boolean): boolean {
  return coupleRole(myName, partnerName, linked) === 'sophie'
}

/** Once a day: not yet shown today. */
export function loveNoteDue(lastShown: string | null, today: string): boolean {
  return lastShown !== today
}
