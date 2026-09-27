import { describe, expect, it } from 'vitest'
import { parseStepImport, parseStepNumber, parseStepText, shouldPublishSteps, stepImportLink, stepSeries, stepSourceOf, withAutoSteps, withManualSteps } from './steps'

const TODAY = '2026-09-27'

describe('step numbers from a Shortcut', () => {
  it('reads plain, grouped and decimal numbers', () => {
    expect(parseStepNumber('8123')).toBe(8123)
    expect(parseStepNumber('8,123')).toBe(8123)
    expect(parseStepNumber('8.123')).toBe(8123)
    expect(parseStepNumber('8 123')).toBe(8123)
    expect(parseStepNumber('8123.0')).toBe(8123)
    expect(parseStepNumber('8123,6')).toBe(8124)
    expect(parseStepNumber('12,345.5')).toBe(12346)
    expect(parseStepNumber('12.345,5')).toBe(12346)
    expect(parseStepNumber('0')).toBe(0)
  })
  it('refuses anything else', () => {
    for (const bad of ['', '-5', 'abc', '1e5', '8123 steps', 'NaN']) expect(parseStepNumber(bad), bad).toBeNull()
  })
})

describe('import link', () => {
  it('takes steps for today when there is no date', () => {
    expect(parseStepImport('steps=8123', TODAY)).toEqual({ ok: true, days: [{ date: TODAY, steps: 8123 }] })
  })
  it('takes a date and steps', () => {
    expect(parseStepImport('?date=2026-09-26&steps=10444', TODAY)).toEqual({ ok: true, days: [{ date: '2026-09-26', steps: 10444 }] })
  })
  it('takes several days, sorted, including grouped numbers', () => {
    const r = parseStepImport(new URLSearchParams({ d: '2026-09-27:8,123,2026-09-26:10444' }), TODAY)
    expect(r).toEqual({ ok: true, days: [{ date: '2026-09-26', steps: 10444 }, { date: TODAY, steps: 8123 }] })
  })
  it('reads the whole link as copied', () => {
    const link = stepImportLink('https://example.github.io/gym-app/', '9001', '2026-09-25')
    expect(link).toBe('https://example.github.io/gym-app/#/steps/import?date=2026-09-25&steps=9001')
    expect(parseStepText(link, TODAY)).toEqual({ ok: true, days: [{ date: '2026-09-25', steps: 9001 }] })
  })
  it('refuses future dates, dates over 60 days old, bad dates and too many steps', () => {
    expect(parseStepImport('date=2026-09-28&steps=1', TODAY).ok).toBe(false)
    expect(parseStepImport('date=2026-07-29&steps=1', TODAY).ok).toBe(true) // 60 days ago
    expect(parseStepImport('date=2026-07-28&steps=1', TODAY).ok).toBe(false) // 61
    expect(parseStepImport('date=2026-02-30&steps=1', TODAY).ok).toBe(false)
    expect(parseStepImport('steps=100001', TODAY).ok).toBe(false)
    expect(parseStepImport('steps=100000', TODAY).ok).toBe(true)
    expect(parseStepImport('steps=-3', TODAY).ok).toBe(false)
    expect(parseStepImport('', TODAY).ok).toBe(false)
  })
  it('saves nothing if any day is bad', () => {
    expect(parseStepImport('d=2026-09-27:100,2026-09-26:lots', TODAY).ok).toBe(false)
    expect(parseStepImport('d=2026-09-27:100,junk', TODAY).ok).toBe(false)
  })
  it('clipboard text: a bare number is today', () => {
    expect(parseStepText(' 7,412 ', TODAY)).toEqual({ ok: true, days: [{ date: TODAY, steps: 7412 }] })
    expect(parseStepText('hello', TODAY).ok).toBe(false)
    expect(parseStepText('', TODAY).ok).toBe(false)
  })
})

describe('manual wins over counted steps', () => {
  it('fills an empty day and updates a counted one', () => {
    const a = withAutoSteps(undefined, TODAY, { steps: 5000, source: 'sensor' })
    expect(a).toEqual({ date: TODAY, steps: 5000, stepsSource: 'sensor' })
    const b = withAutoSteps({ date: TODAY, weightLb: 190, steps: 5000, stepsSource: 'sensor' }, TODAY, { steps: 6200, source: 'sensor' })
    expect(b).toEqual({ date: TODAY, weightLb: 190, steps: 6200, stepsSource: 'sensor' })
    expect(withAutoSteps(b ?? undefined, TODAY, { steps: 6200, source: 'sensor' })).toBeNull()
  })
  it('never overwrites a typed-in value, including old logs with no source', () => {
    expect(withAutoSteps({ date: TODAY, steps: 4000, stepsSource: 'manual' }, TODAY, { steps: 9000, source: 'sensor' })).toBeNull()
    expect(withAutoSteps({ date: TODAY, steps: 4000 }, TODAY, { steps: 9000, source: 'health-import' })).toBeNull()
    expect(stepSourceOf({ steps: 4000 })).toBe('manual')
    expect(stepSourceOf({})).toBeUndefined()
  })
  it('typing sets manual; clearing falls back to the counted value or nothing', () => {
    const auto = { date: TODAY, steps: 7000, source: 'sensor' as const, updatedAt: 1 }
    expect(withManualSteps({ date: TODAY, steps: 7000, stepsSource: 'sensor' }, TODAY, 3000, auto)).toEqual({ date: TODAY, steps: 3000, stepsSource: 'manual' })
    expect(withManualSteps({ date: TODAY, steps: 3000, stepsSource: 'manual' }, TODAY, undefined, auto)).toEqual({ date: TODAY, steps: 7000, stepsSource: 'sensor' })
    expect(withManualSteps({ date: TODAY, steps: 3000, stepsSource: 'manual', fatigue: 2 }, TODAY, undefined, undefined)).toEqual({ date: TODAY, fatigue: 2 })
  })
})

describe('sharing steps with a partner', () => {
  const prev = { date: TODAY, steps: 5000, at: 0 }
  it('sends a new day or a big change right away, a small change after 10 minutes', () => {
    expect(shouldPublishSteps(undefined, { date: TODAY, steps: 10 }, 1)).toBe(true)
    expect(shouldPublishSteps(prev, { date: '2026-09-28', steps: 0 }, 1)).toBe(true)
    expect(shouldPublishSteps(prev, { date: TODAY, steps: 5250 }, 1)).toBe(true)
    expect(shouldPublishSteps(prev, { date: TODAY, steps: 5100 }, 60_000)).toBe(false)
    expect(shouldPublishSteps(prev, { date: TODAY, steps: 5100 }, 600_000)).toBe(true)
    expect(shouldPublishSteps(prev, { date: TODAY, steps: 5000 }, 10_000_000)).toBe(false)
  })
})

describe('step series for the chart', () => {
  it('covers the last n days, oldest first, with gaps', () => {
    const s = stepSeries([{ date: '2026-09-25', steps: 9000 }, { date: TODAY, steps: 3000 }, { date: '2026-09-20', steps: 1 }], TODAY, 3)
    expect(s).toEqual([
      { date: '2026-09-25', steps: 9000 },
      { date: '2026-09-26', steps: undefined },
      { date: TODAY, steps: 3000 },
    ])
  })
})
