import { useId, useState } from 'react'
import { downloadBackup, importBackupFile } from '../db/backup'
import { isDemoMode } from '../db/db'
import { resetAllData, resetProgram } from '../db/repo'
import { enterDemoMode, exitDemoMode } from '../dev/demoMode'
import { Button } from './ui'

export function DataSection() {
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileId = useId()
  const demo = isDemoMode()

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg({ tone: 'good', text: ok })
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'Something went wrong.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Stored only in this browser on this device. Nothing is ever uploaded. Download a backup now and then and keep it somewhere safe.</p>
      <Button className="w-full" variant="primary" disabled={busy} onClick={() => void run(() => downloadBackup(false), 'Backup downloaded.')}>
        Download backup (JSON)
      </Button>
      <Button className="w-full" disabled={busy} onClick={() => void run(() => downloadBackup(true), 'Backup with photos downloaded.')}>
        Download backup with photos (larger)
      </Button>
      <label htmlFor={fileId} className={`flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-surface-2 font-semibold ${busy ? 'opacity-40' : ''}`}>
        Restore from backup file…
      </label>
      <input
        id={fileId}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          if (!window.confirm(`Replace ALL current data with “${f.name}”? Download a backup of what's here first if you might want it.`)) return
          void run(() => importBackupFile(f), 'Backup restored.')
        }}
      />
      {msg && (
        <p role="status" className={`text-sm ${msg.tone === 'good' ? 'text-good' : 'text-bad'}`}>
          {msg.text}
        </p>
      )}

      <div className="border-t border-line pt-2">
        <p className="text-sm font-medium">Preview with demo data</p>
        <p className="mb-2 text-xs text-muted">About ten weeks of made-up history, so you can see the charts and weekly review. It lives in a separate database; your real data is not touched, and exiting throws the demo away.</p>
        {demo ? (
          <Button className="w-full" onClick={() => exitDemoMode()}>
            Exit demo mode
          </Button>
        ) : (
          <Button className="w-full" disabled={busy} onClick={() => void run(enterDemoMode, 'Loading demo…')}>
            Open demo mode
          </Button>
        )}
      </div>

      <div className="space-y-2 border-t border-line pt-2">
        <Button
          className="w-full"
          onClick={() => {
            if (window.confirm('Put every session and exercise back to the original program? Your logs are kept.')) void resetProgram()
          }}
        >
          Reset program to default
        </Button>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            const typed = window.prompt('This deletes ALL workouts, weigh-ins, photos and settings. Type RESET to confirm.')
            if (typed === 'RESET') void resetAllData().then(() => window.location.reload())
          }}
        >
          Reset all data
        </Button>
      </div>
    </div>
  )
}
