import { describe, expect, it } from 'vitest'
import { coupleRole, resolveAccent } from './accent'

describe('accent colors', () => {
  it('tells Sophie’s and Joshua’s phones apart by the partner link', () => {
    expect(coupleRole('Sophie', 'Joshua', true)).toBe('sophie')
    expect(coupleRole('Josh', 'sophie', true)).toBe('joshua')
    expect(coupleRole('Sophie', 'Joshua', false)).toBeNull()
    expect(coupleRole('Sophie', 'Mark', true)).toBeNull()
    expect(coupleRole('Alex', 'Sam', true)).toBeNull()
  })

  it('uses the picked accent, else pink for her, olive drab for him, orange otherwise', () => {
    expect(resolveAccent(undefined, 'sophie')).toBe('pink')
    expect(resolveAccent(undefined, 'joshua')).toBe('olive')
    expect(resolveAccent(undefined, null)).toBe('orange')
    expect(resolveAccent('orange', 'sophie')).toBe('orange')
    expect(resolveAccent('pink', null)).toBe('pink')
  })
})
