import type { DailyLog, StepDay, StepSource } from '../types'
import { addDays, daysBetween, isIsoDate, type IsoDate } from './dates'

/** Largest believable day. */
export const MAX_DAILY_STEPS = 100_000
/** Imports older than this many days are refused. */
export const IMPORT_WINDOW_DAYS = 60

export type AutoSource = Exclude<StepSource, 'manual'>

export const SOURCE_LABEL: Record<StepSource, string> = {
  sensor: 'counted by this phone',
  'health-import': 'from Apple Health',
  manual: 'typed in',
}

/** Where a logged day's steps came from; logs from before 1.9.0 have no source and were typed in. */
export function stepSourceOf(log: Pick<DailyLog, 'steps' | 'stepsSource'> | undefined): StepSource | undefined {
  if (!log || log.steps === undefined) return undefined
  return log.stepsSource ?? 'manual'
}

/**
 * The day's log after a counted or imported value arrives, or null when nothing changes.
 * A value the user typed in (manual) always wins.
 */
export function withAutoSteps(log: DailyLog | undefined, date: IsoDate, auto: { steps: number; source: AutoSource }): DailyLog | null {
  if (stepSourceOf(log) === 'manual') return null
  if (log?.steps === auto.steps && log.stepsSource === auto.source) return null
  return { ...(log ?? { date }), date, steps: auto.steps, stepsSource: auto.source }
}

/**
 * The day's log after the user types a value (a number) or clears the field
 * (undefined). Clearing falls back to the counted or imported value, if any.
 */
export function withManualSteps(log: DailyLog | undefined, date: IsoDate, steps: number | undefined, auto: StepDay | undefined): DailyLog {
  const next: DailyLog = { ...(log ?? { date }), date }
  if (steps !== undefined) {
    next.steps = Math.round(steps)
    next.stepsSource = 'manual'
  } else if (auto) {
    next.steps = auto.steps
    next.stepsSource = auto.source
  } else {
    delete next.steps
    delete next.stepsSource
  }
  return next
}

/** A step count typed by a person or a Shortcut: "8123", "8,123", "8123.0", "8.123" (European grouping). */
export function parseStepNumber(raw: string): number | null {
  const t = raw.replace(/[\s  ']/g, '')
  let n: number
  if (/^\d+$/.test(t)) n = Number(t)
  else if (/^\d{1,3}([.,]\d{3})+$/.test(t)) n = Number(t.replace(/[.,]/g, ''))
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(t)) n = Number(t.replace(/,/g, ''))
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'))
  else if (/^\d+[.,]\d+$/.test(t)) n = Number(t.replace(',', '.'))
  else return null
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

export interface StepImportDay {
  date: IsoDate
  steps: number
}

export type StepImportResult = { ok: true; days: StepImportDay[] } | { ok: false; error: string }

function checkDay(date: string, rawSteps: string, today: IsoDate): StepImportDay | string {
  if (!isIsoDate(date)) return `"${date}" is not a date (use YYYY-MM-DD).`
  const age = daysBetween(date, today)
  if (age < 0) return `${date} is in the future.`
  if (age > IMPORT_WINDOW_DAYS) return `${date} is more than ${IMPORT_WINDOW_DAYS} days ago.`
  const steps = parseStepNumber(rawSteps)
  if (steps === null) return `"${rawSteps}" is not a step count.`
  if (steps > MAX_DAILY_STEPS) return `${steps.toLocaleString()} steps is more than ${MAX_DAILY_STEPS.toLocaleString()}.`
  return { date, steps }
}

/**
 * Parse an Apple Health import link's query: `steps=N` (today), `date=YYYY-MM-DD&steps=N`,
 * or several days as `d=YYYY-MM-DD:N,YYYY-MM-DD:N`. Every day must be valid or nothing is saved.
 */
export function parseStepImport(query: string | URLSearchParams, today: IsoDate): StepImportResult {
  const q = typeof query === 'string' ? new URLSearchParams(query.replace(/^[^?]*\?/, '')) : query
  const days: StepImportDay[] = []
  const multi = q.get('d')
  if (multi !== null) {
    const re = /(\d{4}-\d{2}-\d{2}):\s*([^:]*?)\s*(?=[,;]\s*\d{4}-\d{2}-\d{2}:|$)/g
    const rest = multi.trim()
    let consumed = 0
    for (const m of rest.matchAll(re)) {
      const between = rest.slice(consumed, m.index).replace(/[,;\s]/g, '')
      if (between) return { ok: false, error: `Could not read "${between}".` }
      const r = checkDay(m[1] ?? '', m[2] ?? '', today)
      if (typeof r === 'string') return { ok: false, error: r }
      days.push(r)
      consumed = (m.index ?? 0) + m[0].length
    }
    if (rest.slice(consumed).replace(/[,;\s]/g, '')) return { ok: false, error: `Could not read "${rest.slice(consumed)}".` }
  }
  const steps = q.get('steps')
  if (steps !== null) {
    const r = checkDay(q.get('date')?.trim() || today, steps, today)
    if (typeof r === 'string') return { ok: false, error: r }
    days.push(r)
  }
  if (days.length === 0) return { ok: false, error: 'The link has no step count in it.' }
  // The same day twice: the last one wins.
  const byDate = new Map(days.map((x) => [x.date, x]))
  return { ok: true, days: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)) }
}

/** Text pasted from a Shortcut: the full import link, its query, or just a number (today). */
export function parseStepText(text: string, today: IsoDate): StepImportResult {
  const t = text.trim()
  if (!t) return { ok: false, error: 'The clipboard is empty.' }
  const n = parseStepNumber(t)
  if (n !== null) return parseStepImport(new URLSearchParams({ steps: String(n) }), today)
  const i = t.indexOf('?')
  if (i >= 0) return parseStepImport(t.slice(i + 1), today)
  if (/(^|&)(d|steps)=/.test(t)) return parseStepImport(t, today)
  return { ok: false, error: 'The clipboard has no step count in it. Run the Shortcut first.' }
}

/** Build the import link a Shortcut opens; `steps` may be a placeholder. */
export function stepImportLink(appUrl: string, steps: string, date?: IsoDate): string {
  const base = appUrl.replace(/#.*$/, '')
  return `${base}#/steps/import?${date ? `date=${date}&` : ''}steps=${steps}`
}

/** Shared step count as the partner sees it. */
export interface SharedSteps {
  date: IsoDate
  steps: number
  at: number
}

const PUBLISH_MIN_CHANGE = 250
const PUBLISH_EVERY_MS = 10 * 60 * 1000

/** Whether to send a new step count to the partner: new day, a big change, or a small one after 10 minutes. */
export function shouldPublishSteps(prev: SharedSteps | undefined, next: { date: IsoDate; steps: number }, now: number): boolean {
  if (!prev || prev.date !== next.date) return true
  const diff = Math.abs(next.steps - prev.steps)
  if (diff === 0) return false
  return diff >= PUBLISH_MIN_CHANGE || now - prev.at >= PUBLISH_EVERY_MS
}

/** Steps for each of the last `n` days ending `today`, oldest first (undefined = not logged). */
export function stepSeries(logs: readonly Pick<DailyLog, 'date' | 'steps'>[], today: IsoDate, n: number): { date: IsoDate; steps: number | undefined }[] {
  const byDate = new Map(logs.map((l) => [l.date, l.steps]))
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    return { date, steps: byDate.get(date) }
  })
}
