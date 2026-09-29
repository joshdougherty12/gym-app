import { describe, expect, it } from 'vitest'
import { accentChoices, accentPref, coupleRole, isSeason, resolveAccent } from './accent'

describe('accent colors', () => {
  it('tells Sophie’s and Joshua’s phones apart by the partner link', () => {
    expect(coupleRole('Sophie', 'Joshua', true)).toBe('sophie')
    expect(coupleRole('Josh', 'sophie', true)).toBe('joshua')
    expect(coupleRole('Sophie', 'Joshua', false)).toBeNull()
    expect(coupleRole('Sophie', 'Mark', true)).toBeNull()
    expect(coupleRole('Alex', 'Sam', true)).toBeNull()
  })

  it('offers Seasonal only on Sophie’s phone', () => {
    expect(accentChoices('sophie').map((a) => a.value)).toContain('seasonal')
    expect(accentChoices('joshua').map((a) => a.value)).not.toContain('seasonal')
    expect(accentChoices(null).map((a) => a.value)).not.toContain('seasonal')
  })

  it('defaults to seasonal for her, olive drab for him, orange otherwise; a pick always wins', () => {
    expect(accentPref(undefined, 'sophie')).toBe('seasonal')
    expect(accentPref(undefined, 'joshua')).toBe('olive')
    expect(accentPref(undefined, null)).toBe('orange')
    expect(accentPref('pink', 'sophie')).toBe('pink')
  })

  it('turns seasonal into today’s theme', () => {
    expect(resolveAccent(undefined, 'sophie', '2026-09-29')).toBe('fall')
    expect(resolveAccent(undefined, 'sophie', '2026-10-01')).toBe('halloween')
    expect(resolveAccent(undefined, 'sophie', '2027-05-21')).toBe('birthday')
    expect(resolveAccent('seasonal', null, '2027-05-21')).toBe('orange') // seasonal themes are hers alone
    expect(resolveAccent('seasonal', 'joshua', '2026-10-01')).toBe('orange')
    expect(resolveAccent(undefined, 'joshua', '2026-10-01')).toBe('olive')
    // Joshua's phone stays olive drab every day of the year.
    for (const d of ['2026-09-29', '2026-10-31', '2026-12-25', '2027-05-21', '2027-07-04']) expect(resolveAccent(undefined, 'joshua', d)).toBe('olive')
    expect(isSeason('fall')).toBe(true)
    expect(isSeason('pink')).toBe(false)
  })
})
