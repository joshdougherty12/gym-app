import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE } from '../data/program'
import { assignDay, sessionDays, swapDays } from './schedule'
import { displayWeight, formatNumber, inputWeightToLb, roundTo } from './units'

describe('schedule', () => {
  it('swaps days when a session moves onto a day that already has one', () => {
    // Move Push (Thu) to Wednesday: zone 2 goes to Thursday.
    const s = assignDay(DEFAULT_SCHEDULE, 3, { kind: 'session', sessionId: 'push' })
    expect(s[3]).toEqual({ kind: 'session', sessionId: 'push' })
    expect(s[4]).toEqual({ kind: 'zone2', minutes: 30 })
    expect(sessionDays(s)).toHaveLength(5)
  })

  it('keeps each session exactly once', () => {
    const s = assignDay(DEFAULT_SCHEDULE, 1, { kind: 'session', sessionId: 'pull' })
    const ids = sessionDays(s).map((x) => x.sessionId).sort()
    expect(ids).toEqual(['legs-conditioning', 'lower-heavy', 'pull', 'push', 'upper-heavy'])
    expect(s[5]).toEqual({ kind: 'session', sessionId: 'upper-heavy' })
  })

  it('swaps two days directly', () => {
    const s = swapDays(DEFAULT_SCHEDULE, 6, 0)
    expect(s[0]).toEqual({ kind: 'session', sessionId: 'legs-conditioning' })
    expect(s[6]).toEqual({ kind: 'walk' })
  })

  it('does not mutate the input', () => {
    const before = JSON.stringify(DEFAULT_SCHEDULE)
    assignDay(DEFAULT_SCHEDULE, 3, { kind: 'rest' })
    expect(JSON.stringify(DEFAULT_SCHEDULE)).toBe(before)
  })
})

describe('units', () => {
  it('round-trips kg input to lb and back', () => {
    const lb = inputWeightToLb(100, 'metric')
    expect(displayWeight(lb, 'metric')).toBe(100)
    expect(displayWeight(195, 'imperial')).toBe(195)
  })

  it('rounds without float noise', () => {
    expect(roundTo(72.4999999, 0.5)).toBe(72.5)
    expect(formatNumber(72.5)).toBe('72.5')
    expect(formatNumber(225)).toBe('225')
  })
})
