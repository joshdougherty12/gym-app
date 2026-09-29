import { describe, expect, it } from 'vitest'
import { easterSunday, seasonFor } from './seasons'

describe('seasonal themes', () => {
  it('knows Easter', () => {
    expect(easterSunday(2026)).toBe('2026-04-05')
    expect(easterSunday(2027)).toBe('2027-03-28')
    expect(easterSunday(2028)).toBe('2028-04-16')
    expect(easterSunday(2029)).toBe('2029-04-01')
  })

  it('follows the calendar', () => {
    expect(seasonFor('2026-09-29')).toBe('fall')
    expect(seasonFor('2026-09-22')).toBe('fall')
    expect(seasonFor('2026-10-01')).toBe('halloween')
    expect(seasonFor('2026-10-31')).toBe('halloween')
    expect(seasonFor('2026-11-01')).toBe('thanksgiving')
    expect(seasonFor('2026-12-01')).toBe('christmas')
    expect(seasonFor('2026-12-30')).toBe('christmas')
    expect(seasonFor('2026-12-31')).toBe('nye')
    expect(seasonFor('2027-01-01')).toBe('winter')
    expect(seasonFor('2026-03-19')).toBe('winter') // Easter 2026 is April 5, so its window starts March 22
    expect(seasonFor('2027-06-13')).toBe('spring')
    expect(seasonFor('2027-06-14')).toBe('patriotic')
    expect(seasonFor('2027-07-04')).toBe('patriotic')
    expect(seasonFor('2027-07-05')).toBe('summer')
    expect(seasonFor('2027-09-21')).toBe('summer')
  })

  it('gives Easter the two weeks either side', () => {
    // Easter 2027 is March 28: March 14 to April 11.
    expect(seasonFor('2027-03-13')).toBe('winter')
    expect(seasonFor('2027-03-14')).toBe('easter')
    expect(seasonFor('2027-04-11')).toBe('easter')
    expect(seasonFor('2027-04-12')).toBe('spring')
  })

  it('has a birthday on May 21, only on Sophie’s phone', () => {
    expect(seasonFor('2027-05-21', true)).toBe('birthday')
    expect(seasonFor('2027-05-21')).toBe('spring')
    expect(seasonFor('2027-05-22', true)).toBe('spring')
  })
})
