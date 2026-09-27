import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { SHARED_TEXT } from '../components/partner/PartnerSection'
import { Button, Card, Loading, Screen } from '../components/ui'
import { useSettings } from '../db/repo'
import { APP_NAME } from '../lib/brand'
import { isNative } from '../lib/native'
import { decodeLinkCode, LinkCodeError } from '../lib/partner/pairing'
import { copyText } from '../lib/shareText'
import { partnerAvailable } from '../partner/config'
import { joinHousehold, LinkError } from '../partner/engine'
import { usePartner } from '../partner/hooks'
import { syncNow } from '../partner/useSync'

// The code arrives in the URL fragment. It is moved into memory and the
// address bar is cleaned so the key does not linger in the visible URL.
let pendingCode: string | null = null

/** #/link/<code>: remember the code, then show the link screen without it in the address. */
export function LinkCodeRoute() {
  const { code } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    if (code) pendingCode = code
    navigate('/link', { replace: true })
  }, [code, navigate])
  return <Loading />
}

export function LinkScreen() {
  const p = usePartner()
  const settings = useSettings()
  const navigate = useNavigate()
  const [code] = useState(() => pendingCode)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    pendingCode = null
  }, [])

  if (!p || !settings) return <Loading />
  if (!partnerAvailable()) {
    return (
      <Screen title="Partner" back="/">
        <Card>Partner link isn’t available in this version yet.</Card>
      </Screen>
    )
  }
  let valid = true
  try {
    if (code) decodeLinkCode(code)
  } catch {
    valid = false
  }
  if (!code || !valid) {
    return (
      <Screen title="Partner" back="/">
        <Card>
          <p>{code ? 'That link is damaged. Ask your partner to send it again, or paste the code in Settings → Partner → Enter link code.' : 'Open the link your partner sent, or paste the code in Settings → Partner.'}</p>
          <Link to="/settings" className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-accent font-bold text-accent-ink">
            Open Settings
          </Link>
        </Card>
      </Screen>
    )
  }
  if (p.link) {
    return (
      <Screen title="Partner" back="/">
        <Card>
          <p>{p.link.status === 'linked' ? `This phone is already linked with ${p.partnerName}.` : 'This phone is waiting for a partner of its own.'} To use this link instead, unlink first in Settings → Partner.</p>
          <Link to="/settings" className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-accent font-bold text-accent-ink">
            Open Settings
          </Link>
        </Card>
      </Screen>
    )
  }

  const join = async () => {
    setBusy(true)
    setErr(null)
    try {
      await joinHousehold(code)
      void syncNow()
      navigate(settings.profile ? '/' : '/welcome', { replace: true })
    } catch (e) {
      setErr(e instanceof LinkError || e instanceof LinkCodeError ? e.message : 'Could not link. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Link partner" subtitle={APP_NAME}>
      <Card className="space-y-3">
        <p className="font-semibold">Link this phone with your partner?</p>
        <p className="text-sm text-muted">{SHARED_TEXT}</p>
        <p className="text-sm text-muted">Their week plan and grocery list replace this phone’s; saved recipes from both phones are combined. Everything shared is end-to-end encrypted.</p>
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => void join()}>
          {busy ? 'Linking…' : 'Link'}
        </Button>
        {err && (
          <p role="alert" className="text-sm text-bad">
            {err}
          </p>
        )}
      </Card>
      {!isNative() && (
        <Card className="mt-3 space-y-2">
          <p className="text-sm">
            Already use {APP_NAME} from your Home Screen, or the Android app? Link there instead so your own data stays in one place: copy the code, open the app and paste it under Settings → Partner → <em>Enter link code</em>.
          </p>
          <Button className="w-full" onClick={() => void copyText(code).then(setCopied)}>
            {copied ? 'Code copied' : 'Copy code'}
          </Button>
        </Card>
      )}
    </Screen>
  )
}
