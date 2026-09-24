import { describe, expect, it } from 'vitest'
import { datesOfWeek, hasWeekZero, pauseOn, programWeek, week1Monday } from './calendar'
import { addDays, mondayOf, weekdayOf } from './dates'

// 2026-09-24 is a Thursday; the first Monday after it is 2026-09-28.
const START = '2026-09-24'

describe('dates', () => {
  it('knows weekdays and Mondays', () => {
    expect(weekdayOf('2026-09-24')).toBe(4)
    expect(mondayOf('2026-09-24')).toBe('2026-09-21')
    expect(mondayOf('2026-09-27')).toBe('2026-09-21') // Sunday belongs to the week before
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
  })

  it('adds days across a DST change and a month end', () => {
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02') // US DST ends 2026-11-01
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09') // US DST starts 2026-03-08
  })
})

describe('programWeek', () => {
  it('starts with a week 0 when the start date is not a Monday', () => {
    expect(week1Monday(START)).toBe('2026-09-28')
    expect(hasWeekZero(START)).toBe(true)
    expect(programWeek('2026-09-24', START)).toBe(0)
    expect(programWeek('2026-09-27', START)).toBe(0)
    expect(programWeek('2026-09-28', START)).toBe(1)
    expect(programWeek('2026-10-04', START)).toBe(1)
    expect(programWeek('2026-10-05', START)).toBe(2)
  })

  it('has no week 0 when the start date is a Monday', () => {
    expect(hasWeekZero('2026-09-28')).toBe(false)
    expect(programWeek('2026-09-28', '2026-09-28')).toBe(1)
  })

  it('returns null before the start date', () => {
    expect(programWeek('2026-09-23', START)).toBeNull()
  })

  it('reaches week 12 and keeps counting after it', () => {
    // Week 12 starts 11 weeks after week 1.
    expect(programWeek(addDays('2026-09-28', 77), START)).toBe(12)
    expect(programWeek(addDays('2026-09-28', 84), START)).toBe(13)
  })

  it('holds the week during a pause and resumes at it afterwards', () => {
    // 2026-10-12 is the Monday of raw week 3.
    const pauses = [{ id: 'p', start: '2026-10-12', weeks: 1 }]
    expect(programWeek('2026-10-11', START, pauses)).toBe(2)
    expect(programWeek('2026-10-12', START, pauses)).toBe(3) // paused, holding at 3
    expect(pauseOn('2026-10-18', pauses)?.id).toBe('p')
    expect(programWeek('2026-10-19', START, pauses)).toBe(3) // resumes at 3
    expect(pauseOn('2026-10-19', pauses)).toBeUndefined()
    expect(programWeek('2026-10-26', START, pauses)).toBe(4)
  })

  it('never moves the week backwards, even for multi-week or stacked pauses', () => {
    const pauses = [
      { id: 'a', start: '2026-10-12', weeks: 1 },
      { id: 'b', start: '2026-11-02', weeks: 2 },
    ]
    let prev = -1
    for (let i = 0; i < 120; i++) {
      const w = programWeek(addDays(START, i), START, pauses)
      expect(w).not.toBeNull()
      expect(w as number).toBeGreaterThanOrEqual(prev)
      prev = w as number
    }
    expect(programWeek('2026-11-01', START, pauses)).toBe(4)
    expect(programWeek('2026-11-02', START, pauses)).toBe(5) // paused 2 weeks at 5
    expect(programWeek('2026-11-09', START, pauses)).toBe(5)
    expect(programWeek('2026-11-16', START, pauses)).toBe(5) // resumes at 5
    expect(programWeek('2026-11-23', START, pauses)).toBe(6)
  })

  it('can be added after the fact without touching earlier weeks', () => {
    // Sick during raw week 4; decided the following week to redo it.
    const pauses = [{ id: 'p', start: '2026-10-19', weeks: 1 }]
    expect(programWeek('2026-10-18', START, pauses)).toBe(3)
    expect(programWeek('2026-10-26', START, pauses)).toBe(4)
  })
})

describe('datesOfWeek', () => {
  it('clips week 0 to the start date', () => {
    expect(datesOfWeek(0, START)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'])
  })

  it('returns Monday to Sunday for later weeks', () => {
    const d = datesOfWeek(1, START)
    expect(d[0]).toBe('2026-09-28')
    expect(d[6]).toBe('2026-10-04')
  })

  it('returns the trained occurrence of a week that was paused', () => {
    const pauses = [{ id: 'p', start: '2026-10-12', weeks: 1 }]
    expect(datesOfWeek(2, START, pauses)[0]).toBe('2026-10-05')
    expect(datesOfWeek(3, START, pauses)[0]).toBe('2026-10-19')
    expect(datesOfWeek(4, START, pauses)[0]).toBe('2026-10-26')
  })

  it('has no days for week 0 when the program starts on a Monday', () => {
    expect(datesOfWeek(0, '2026-09-28')).toEqual([])
  })
})
