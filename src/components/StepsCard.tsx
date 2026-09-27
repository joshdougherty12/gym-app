import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { db } from '../db/db'
import { saveAutoSteps } from '../db/steps'
import { shortDate, todayIso } from '../lib/dates'
import { stepCounterSupported } from '../lib/stepCounter'
import { parseStepText, SOURCE_LABEL, stepSourceOf, type StepImportResult } from '../lib/steps'
import { useStepStatus } from '../hooks/useStepSync'
import { openSettingsSection } from './Accordion'
import { useToast } from './Recipes'
import { Button, Card } from './ui'

/** Read a Shortcut's step link (or a number) from the clipboard and save it. Returns a message to show. */
export async function pasteSteps(): Promise<string> {
  let text: string | null = null
  try {
    text = await navigator.clipboard.readText()
  } catch {
    // Clipboard reading refused or unsupported: ask for it instead.
    text = window.prompt('Paste the step link from the Shortcut')
  }
  if (text === null) return 'Nothing pasted.'
  return saveImport(parseStepText(text, todayIso()))
}

export async function saveImport(r: StepImportResult): Promise<string> {
  if (!r.ok) return r.error
  await saveAutoSteps(r.days, 'health-import')
  const today = todayIso()
  if (r.days.length === 1 && r.days[0]) {
    const d = r.days[0]
    return `Saved ${d.steps.toLocaleString()} steps for ${d.date === today ? 'today' : shortDate(d.date)}`
  }
  return `Saved steps for ${r.days.length} days`
}

/** A ring that fills toward the goal. */
function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const frac = goal > 0 ? Math.min(1, value / goal) : 0
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--chart-1)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} />
    </svg>
  )
}

/** Today: steps so far against the goal, with where the number came from. */
export function StepsCard({ goal }: { goal: number }) {
  const today = todayIso()
  const log = useLiveQuery(() => db.dailyLogs.get(today), [today])
  const status = useStepStatus((s) => s.status)
  const [toastNode, toast] = useToast()
  const native = stepCounterSupported()
  const counting = native && status?.enabled === true
  const steps = log?.steps ?? (counting ? 0 : undefined)
  const source = stepSourceOf(log)
  const pct = steps !== undefined && goal > 0 ? Math.round((steps / goal) * 100) : 0

  return (
    <Card className="mt-3">
      <div className="flex items-center gap-3">
        <Ring value={steps ?? 0} goal={goal} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Steps</p>
          <p className="num text-3xl leading-tight font-bold" aria-label={`${steps?.toLocaleString() ?? 'No'} of ${goal.toLocaleString()} steps`}>
            {steps === undefined ? '—' : steps.toLocaleString()} <span className="text-base font-normal text-muted">/ {goal.toLocaleString()}</span>
          </p>
          <p className="text-xs text-muted">
            {steps === undefined ? 'Not logged yet' : `${pct}% of goal`}
            {source ? ` · ${SOURCE_LABEL[source]}` : counting ? ` · ${SOURCE_LABEL.sensor}` : ''}
          </p>
        </div>
      </div>
      {native && status && status.available && !status.enabled && (
        <Link to="/settings" onClick={() => openSettingsSection('steps')} className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold">
          Turn on step counting
        </Link>
      )}
      {!native && (
        <Button variant="ghost" className="mt-1 w-full" onClick={() => void pasteSteps().then(toast)}>
          Paste steps from Shortcut
        </Button>
      )}
      {toastNode}
    </Card>
  )
}
