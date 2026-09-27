import { useState } from 'react'
import { refreshSteps, useStepStatus } from '../hooks/useStepSync'
import { disableStepCounting, enableStepCounting, openStepSettings, requestStepPermission, stepCounterSupported } from '../lib/stepCounter'
import { stepImportLink } from '../lib/steps'
import { partnerAvailable } from '../partner/config'
import type { Settings } from '../types'
import { pasteSteps } from './StepsCard'
import { useToast } from './Recipes'
import { Button } from './ui'

/** One-line summary for the Settings accordion. */
export function useStepsSummary(stepGoal: number | undefined): string {
  const status = useStepStatus((s) => s.status)
  const goal = `goal ${(stepGoal ?? 0).toLocaleString()}`
  if (!stepCounterSupported()) return `Apple Health via Shortcuts · ${goal}`
  if (!status) return goal
  if (!status.available) return `No step counter on this phone · ${goal}`
  return `${status.enabled ? 'Counting' : 'Off'} · ${goal}`
}

function AndroidSteps() {
  const status = useStepStatus((s) => s.status)
  const setStatus = useStepStatus((s) => s.set)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!status) return <p className="text-sm text-muted">Checking the step counter…</p>
  if (!status.available) return <p className="text-sm text-muted">This phone has no step counter, so steps can’t be counted automatically. Type them in the daily check-in instead.</p>

  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      const p = await requestStepPermission()
      setStatus(p)
      if (p.permission !== 'granted') {
        setError('Step counting needs the “Physical activity” permission. You can allow it in the app’s settings.')
        return
      }
      setStatus(await enableStepCounting())
      await refreshSteps()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn on step counting.')
    } finally {
      setBusy(false)
    }
  }
  const turnOff = async () => {
    setBusy(true)
    setStatus(await disableStepCounting())
    setBusy(false)
  }

  if (status.enabled && status.permission === 'granted') {
    return (
      <div className="space-y-2">
        <p className="text-sm">
          <span className="font-semibold text-good">On.</span> RightPace counts your steps in the background with the phone’s built-in step sensor, and fills them into the daily check-in. A typed-in number always wins for that day.
        </p>
        <p className="text-xs text-muted">
          A silent “Counting steps” notification stays while it’s on: Android only counts steps while an app is listening. It uses the low-power step sensor, not GPS. Steps start counting from when you turned this on, and continue after a restart.
        </p>
        <Button className="w-full" disabled={busy} onClick={() => void turnOff()}>
          Turn off step counting
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">Count steps automatically with the phone’s built-in step sensor. Android will ask to allow “Physical activity”: RightPace uses it only to read the step count, which stays on this phone.</p>
      {status.enabled && status.permission !== 'granted' && <p className="text-sm text-warn">Step counting is on, but the Physical activity permission was removed, so nothing is being counted.</p>}
      <Button variant="primary" className="w-full" disabled={busy} onClick={() => void turnOn()}>
        Turn on step counting
      </Button>
      {(error || status.permission === 'denied') && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p>{error ?? 'Physical activity permission is off for RightPace.'}</p>
          <p className="mt-1 text-xs text-muted">Open app settings → Permissions → Physical activity → Allow, then come back and tap Turn on.</p>
          <Button className="mt-2 w-full" onClick={() => void openStepSettings()}>
            Open app settings
          </Button>
        </div>
      )}
    </div>
  )
}

function ShortcutSteps() {
  const [toastNode, toast] = useToast()
  const appUrl = `${window.location.origin}${window.location.pathname}`
  const template = stepImportLink(appUrl, 'STEPS', 'DATE')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(template)
      toast('Link template copied')
    } catch {
      window.prompt('Copy this link', template)
    }
  }
  return (
    <div className="space-y-3 text-sm">
      <p>Safari can’t read Apple Health, but an iPhone Shortcut can send your step count to RightPace. Set it up once:</p>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          Open the <strong>Shortcuts</strong> app → <strong>Automation</strong> → <strong>+</strong> → <strong>Time of Day</strong>. Pick <strong>9:00 PM, Daily</strong>, choose <strong>Run Immediately</strong> (turn off “Notify When Run” if you like), then <strong>Next</strong> → <strong>New Blank Automation</strong>.
        </li>
        <li>
          Add <strong>Find Health Samples</strong>: Type <strong>Steps</strong>, filter <strong>Start Date is Today</strong>. Allow Health access when asked. If you also wear an Apple Watch, add a filter <strong>Source is</strong> your iPhone (or the Watch) so steps aren’t counted twice.
        </li>
        <li>
          Add <strong>Calculate Statistics</strong>: <strong>Sum</strong> of Health Samples.
        </li>
        <li>
          Add <strong>Format Date</strong>: Current Date, Date Format <strong>Custom</strong>, format <strong>yyyy-MM-dd</strong>, Time Format <strong>None</strong>.
        </li>
        <li>
          Add <strong>Text</strong> and paste the link template (button below). Replace <strong>DATE</strong> with the Formatted Date variable and <strong>STEPS</strong> with the Statistics variable.
        </li>
        <li>
          Last action, depending on how you open RightPace:
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>From the Home Screen icon</strong> (most people): add <strong>Copy to Clipboard</strong> (Text). When you next open RightPace, tap <strong>Paste steps from Shortcut</strong> on Today.
            </li>
            <li>
              <strong>In a Safari tab</strong>: add <strong>Open URLs</strong> (Text) instead. RightPace opens, saves the steps and goes back to Today.
            </li>
          </ul>
        </li>
      </ol>
      <Button className="w-full" onClick={() => void copy()}>
        Copy link template
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => void pasteSteps().then(toast)}>
        Paste steps from Shortcut
      </Button>
      <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
        <p>
          <strong className="text-ink">Why two ways:</strong> on iPhone the Home Screen app and Safari keep separate data. A Shortcut’s “Open URLs” always opens Safari, never the Home Screen app, so steps sent that way land in Safari’s copy. If you use the Home Screen icon, use Copy to Clipboard and paste.
        </p>
        <p className="mt-1">The link includes the date, so pasting the next morning still saves to the right day. The Shortcut can also be run by hand any time (add it to the Home Screen from its menu). Typed-in steps always win over imported ones.</p>
      </div>
      {toastNode}
    </div>
  )
}

/** Settings → Steps. */
export function StepsSettings({ settings }: { settings: Settings }) {
  return (
    <div className="space-y-4">
      {stepCounterSupported() ? <AndroidSteps /> : <ShortcutSteps />}
      {partnerAvailable() && (
        <div className="border-t border-line pt-3">
          <p className="text-sm">
            Sharing steps with your partner: <strong>{settings.partner.shareSteps ? 'on' : 'off'}</strong>
          </p>
          <p className="text-xs text-muted">Change it in Settings → Partner, under “What your partner sees”.</p>
        </div>
      )}
    </div>
  )
}
