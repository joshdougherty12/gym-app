import { describe, expect, it } from 'vitest'
import { backoffMs, dueEntries, failed, nextTs, shouldApply, type OutboxEntry } from './merge'

describe('last writer wins', () => {
  it('a local edit always moves past the last known timestamp', () => {
    expect(nextTs(undefined, 1000)).toBe(1000)
    expect(nextTs(500, 1000)).toBe(1000)
    // The partner's clock is ahead: the edit still wins.
    expect(nextTs(5000, 1000)).toBe(5001)
  })

  it('applies a pulled record that is at least as new', () => {
    expect(shouldApply(undefined, 1)).toBe(true)
    expect(shouldApply(10, 11)).toBe(true)
    expect(shouldApply(10, 10)).toBe(true) // the server keeps the first write of a tie
    expect(shouldApply(10, 9)).toBe(false)
  })
})

describe('sync queue retry', () => {
  const e = (key: string, nextAttemptAt: number, attempts = 0): OutboxEntry => ({ key, type: 'grocery', id: key, attempts, nextAttemptAt })

  it('backs off exponentially up to five minutes', () => {
    expect(backoffMs(1)).toBe(2000)
    expect(backoffMs(2)).toBe(4000)
    expect(backoffMs(3)).toBe(8000)
    expect(backoffMs(20)).toBe(300_000)
  })

  it('sends only what is due, oldest first, up to the limit', () => {
    const list = [e('c', 300), e('a', 100), e('late', 5000), e('b', 200)]
    expect(dueEntries(list, 1000, 10).map((x) => x.key)).toEqual(['a', 'b', 'c'])
    expect(dueEntries(list, 1000, 2).map((x) => x.key)).toEqual(['a', 'b'])
  })

  it('a failed entry waits longer each time', () => {
    const once = failed(e('a', 0), 1000)
    expect(once).toMatchObject({ attempts: 1, nextAttemptAt: 3000 })
    const twice = failed(once, 3000)
    expect(twice).toMatchObject({ attempts: 2, nextAttemptAt: 7000 })
    expect(dueEntries([twice], 6999, 10)).toEqual([])
    expect(dueEntries([twice], 7000, 10)).toHaveLength(1)
  })
})
