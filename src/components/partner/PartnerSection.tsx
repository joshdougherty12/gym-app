import { useId, useState } from 'react'
import { updateSettings } from '../../db/repo'
import { APP_NAME, WEB_APP_URL } from '../../lib/brand'
import { isNative } from '../../lib/native'
import { codeFromInput, LinkCodeError, linkUrl } from '../../lib/partner/pairing'
import { copyText, shareText } from '../../lib/shareText'
import { partnerAvailable } from '../../partner/config'
import { createHousehold, joinHousehold, LinkError, linkCodeFor, refreshOwnRecords, unlink } from '../../partner/engine'
import { usePartner } from '../../partner/hooks'
import { syncNow, useSyncStatus } from '../../partner/useSync'
import type { PartnerLinkRow, Settings } from '../../types'
import { Button, Toggle } from '../ui'
import { QrCode } from './QrCode'
import { SyncBadge } from './SyncBadge'

/** One-line summary for the Settings accordion. */
export function usePartnerSummary(): string {
  const p = usePartner()
  if (!partnerAvailable()) return 'Not available yet'
  if (!p?.link) return 'Not linked · share the kitchen with your partner'
  if (p.link.status === 'waiting') return 'Waiting for your partner to join'
  return `Linked with ${p.partnerName}`
}

/** The web app's address for link codes: this page on the web, the public address in the Android app. */
function webBase(): string {
  if (!isNative() && typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) return location.href.split('#')[0] ?? WEB_APP_URL
  return WEB_APP_URL
}

export const SHARED_TEXT = 'Shared: the week plan and dinner picks, the grocery list (check items off together at the store), saved recipes, and workout summaries (session, time, sets and new records). Private: body weight, check-ins, photos and your meal log.'

export function PartnerSection({ settings }: { settings: Settings }) {
  const p = usePartner()
  const partnerLeft = useSyncStatus((s) => s.partnerLeft)
  const setStatus = useSyncStatus((s) => s.set)
  if (!partnerAvailable()) return <p className="text-sm text-muted">Partner link isn’t available yet.</p>
  if (!p) return null
  const setPartner = (patch: Partial<Settings['partner']>) =>
    void updateSettings({ partner: { ...settings.partner, ...patch } })
      .then(() => refreshOwnRecords())
      .then(() => syncNow())
  return (
    <div className="space-y-3">
      {partnerLeft && !p.link && (
        <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">
          The link was ended. Everything you had stays on this phone.{' '}
          <button type="button" className="font-semibold text-accent" onClick={() => setStatus({ partnerLeft: false })}>
            OK
          </button>
        </p>
      )}
      <NameField settings={settings} onSave={(name) => setPartner({ name })} />
      {!p.link && <NotLinked />}
      {p.link?.status === 'waiting' && <Waiting link={p.link} />}
      {p.link?.status === 'linked' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="flex-1 font-semibold">Linked with {p.partnerName}</p>
            <SyncBadge />
          </div>
          <p className="text-xs text-muted">{SHARED_TEXT}</p>
          <Toggle label="Share my workout summaries" hint="Session, time, sets and new records. Never your body weight." checked={settings.partner.shareWorkouts} onChange={(shareWorkouts) => setPartner({ shareWorkouts })} />
          <Toggle label="Share my calorie target" hint="Used to suggest each person’s portion of shared dinners." checked={settings.partner.shareCalorieTarget} onChange={(shareCalorieTarget) => setPartner({ shareCalorieTarget })} />
          <Button className="w-full" onClick={() => void syncNow()}>
            Sync now
          </Button>
        </div>
      )}
      {p.link && <UnlinkButton waiting={p.link.status === 'waiting'} />}
    </div>
  )
}

function NameField({ settings, onSave }: { settings: Settings; onSave: (name: string) => void }) {
  const id = useId()
  const [name, setName] = useState(settings.partner.name)
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
        Your name (shown to your partner)
      </label>
      <input
        id={id}
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() !== settings.partner.name) onSave(name.trim())
        }}
        placeholder={settings.profile?.name || 'e.g. Josh'}
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3"
      />
    </div>
  )
}

function NotLinked() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [entering, setEntering] = useState(false)
  const [code, setCode] = useState('')
  const codeId = useId()
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      void syncNow()
    } catch (e) {
      setErr(e instanceof LinkError || e instanceof LinkCodeError ? e.message : 'Could not reach the sync server. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Link {APP_NAME} with your partner’s phone (Android or iPhone) to plan meals and shop together and cheer each other on. Everything shared is end-to-end encrypted: the sync server can’t read it.</p>
      <p className="text-xs text-muted">{SHARED_TEXT}</p>
      <Button variant="primary" className="w-full" disabled={busy} onClick={() => void run(() => createHousehold())}>
        {busy && !entering ? 'Creating a link…' : 'Link partner'}
      </Button>
      {!entering ? (
        <Button className="w-full" onClick={() => setEntering(true)}>
          Enter link code
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <label htmlFor={codeId} className="text-sm font-medium">
            Paste the link code (or link) from your partner’s phone
          </label>
          <textarea id={codeId} value={code} onChange={(e) => setCode(e.target.value)} rows={3} autoComplete="off" spellCheck={false} className="w-full rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs break-all" />
          <p className="text-xs text-muted">Their week plan and grocery list replace this phone’s; saved recipes from both phones are combined.</p>
          <Button variant="primary" className="w-full" disabled={busy || !code.trim()} onClick={() => void run(() => joinHousehold(codeFromInput(code)))}>
            {busy ? 'Linking…' : 'Link with this code'}
          </Button>
        </div>
      )}
      {err && (
        <p role="alert" className="text-sm text-bad">
          {err}
        </p>
      )}
    </div>
  )
}

function Waiting({ link }: { link: PartnerLinkRow }) {
  const code = linkCodeFor(link)
  const url = linkUrl(webBase(), code)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <p className="font-semibold">Waiting for your partner…</p>
      <QrCode text={url} label="Link QR code" />
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          <strong>iPhone, new to {APP_NAME}:</strong> point the Camera at this code and open the link in Safari, tap <em>Link</em>, then Share → <em>Add to Home Screen</em>.
        </li>
        <li>
          <strong>iPhone with {APP_NAME} already on the Home Screen:</strong> open it from there and paste the code in Settings → Partner → <em>Enter link code</em> (Safari and the Home Screen app keep separate data).
        </li>
        <li>
          <strong>Android app:</strong> Settings → Partner → <em>Enter link code</em>, and paste the code you send them.
        </li>
      </ol>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => void copyText(code).then((ok) => setMsg(ok ? 'Code copied' : 'Could not copy'))}>Copy code</Button>
        <Button
          onClick={() =>
            void shareText(`Link ${APP_NAME}`, url).then((r) => setMsg(r === 'copied' ? 'Link copied' : r === 'failed' ? 'Could not share' : null))
          }
        >
          Send link
        </Button>
      </div>
      {msg && (
        <p role="status" className="text-sm text-good">
          {msg}
        </p>
      )}
      <p className="text-xs text-muted">The code contains the key to your shared data. Send it only to your partner. It works for one partner.</p>
      <p className="font-mono text-[11px] break-all text-muted select-all">{code}</p>
    </div>
  )
}

function UnlinkButton({ waiting }: { waiting: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const go = async () => {
    if (!window.confirm(waiting ? 'Cancel this link?' : 'Unlink? Sharing stops on both phones. Each of you keeps what is on your own phone.')) return
    setBusy(true)
    setErr(null)
    try {
      await unlink()
    } catch {
      if (window.confirm('Could not reach the sync server. Unlink this phone anyway? Ask your partner to unlink on their phone too.')) await unlink(undefined, undefined, true)
      else setErr('Not unlinked. Try again when online.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant="danger" className="w-full" disabled={busy} onClick={() => void go()}>
        {waiting ? 'Cancel link' : 'Unlink'}
      </Button>
      {err && (
        <p role="alert" className="text-sm text-bad">
          {err}
        </p>
      )}
    </>
  )
}
