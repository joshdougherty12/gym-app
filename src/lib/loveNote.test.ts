import { describe, expect, it } from 'vitest'
import { isLoveNotePhone, loveNoteDue } from './loveNote'

describe('love note', () => {
  it('shows only on Sophie’s phone, linked with Joshua', () => {
    expect(isLoveNotePhone('Sophie', 'Joshua', true)).toBe(true)
    expect(isLoveNotePhone('sophia D.', 'Josh', true)).toBe(true)
    expect(isLoveNotePhone('Joshua', 'Sophie', true)).toBe(false) // his phone
    expect(isLoveNotePhone('Sophie', 'Joshua', false)).toBe(false) // not linked
    expect(isLoveNotePhone('Sophie', 'Mark', true)).toBe(false) // another Sophie
    expect(isLoveNotePhone(undefined, 'Joshua', true)).toBe(false)
  })

  it('is due once a day', () => {
    expect(loveNoteDue(null, '2026-09-28')).toBe(true)
    expect(loveNoteDue('2026-09-27', '2026-09-28')).toBe(true)
    expect(loveNoteDue('2026-09-28', '2026-09-28')).toBe(false)
  })
})
