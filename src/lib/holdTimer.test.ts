import { describe, expect, it } from 'vitest'
import { formatHold, holdCues, holdView, IDLE, startHold, stopHold } from './holdTimer'

const T0 = 1_000_000

describe('hold timer', () => {
  it('counts down 3 seconds, then counts the hold up past the target', () => {
    const s = startHold(T0, false)
    expect(holdView(s, T0, 30)).toMatchObject({ phase: 'get-set', countdown: 3 })
    expect(holdView(s, T0 + 2500, 30)).toMatchObject({ phase: 'get-set', countdown: 1 })
    expect(holdView(s, T0 + 3000 + 15_000, 30)).toMatchObject({ phase: 'hold', elapsed: 15, progress: 0.5, reachedTarget: false })
    expect(holdView(s, T0 + 3000 + 42_400, 30)).toMatchObject({ phase: 'hold', elapsed: 42, progress: 1, reachedTarget: true })
  })

  it('logs the whole seconds held', () => {
    const s = stopHold(startHold(T0, false), T0 + 3000 + 47_900)
    expect(s).toEqual({ kind: 'done', seconds: 47 })
    expect(holdView(s, T0 + 999_999, 45)).toMatchObject({ phase: 'done', elapsed: 47, reachedTarget: true })
  })

  it('cancels during the get-set countdown', () => {
    expect(stopHold(startHold(T0, false), T0 + 1000)).toEqual(IDLE)
  })

  it('runs per-side holds left, switch, right, and logs the weaker side', () => {
    let s = startHold(T0, true)
    expect(holdView(s, T0 + 4000, 30)).toMatchObject({ phase: 'hold', side: 'left' })
    const leftStop = T0 + 3000 + 35_000
    s = stopHold(s, leftStop)
    expect(holdView(s, leftStop + 1000, 30)).toMatchObject({ phase: 'switch', side: 'right', countdown: 4 })
    s = stopHold(s, leftStop + 5000 + 28_000)
    expect(s).toEqual({ kind: 'done', seconds: 28, leftSec: 35, rightSec: 28 })
  })

  it('keeps the left side if the switch is cancelled', () => {
    const s = stopHold(stopHold(startHold(T0, true), T0 + 3000 + 20_000), T0 + 3000 + 21_000)
    expect(s).toEqual({ kind: 'done', seconds: 0, leftSec: 20, rightSec: 0 })
  })

  it('cues ticks, go, target and switch once each', () => {
    const s = startHold(T0, true)
    const at = (ms: number) => holdView(s, T0 + ms, 10)
    expect(holdCues(holdView(IDLE, T0, 10), at(0))).toEqual(['tick'])
    expect(holdCues(at(0), at(500))).toEqual([])
    expect(holdCues(at(500), at(1000))).toEqual(['tick'])
    expect(holdCues(at(2900), at(3000))).toEqual(['go'])
    expect(holdCues(at(12_900), at(13_000))).toEqual(['target'])
    expect(holdCues(at(13_000), at(14_000))).toEqual([])
    const sw = stopHold(s, T0 + 20_000)
    expect(holdCues(at(19_900), holdView(sw, T0 + 20_000, 10))).toEqual(['switch'])
  })

  it('formats minutes and seconds', () => {
    expect(formatHold(0)).toBe('0:00')
    expect(formatHold(45)).toBe('0:45')
    expect(formatHold(125.7)).toBe('2:05')
  })
})
