import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { saveImport } from '../components/StepsCard'
import { Button, Card, Screen } from '../components/ui'
import { todayIso } from '../lib/dates'
import { parseStepImport } from '../lib/steps'

/** #/steps/import?steps=N (or date=…&steps=…, or d=date:N,date:N): opened by an Apple Health Shortcut. */
export function StepImportScreen() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const parsed = parseStepImport(params, todayIso())
    void saveImport(parsed).then((text) => setResult({ ok: parsed.ok, text }))
  }, [params])

  useEffect(() => {
    if (!result?.ok) return
    const t = window.setTimeout(() => navigate('/', { replace: true }), 2500)
    return () => window.clearTimeout(t)
  }, [result, navigate])

  return (
    <Screen title="Steps">
      <Card>
        {result === null ? (
          <p role="status">Saving…</p>
        ) : (
          <>
            <p role="status" className={`text-lg font-semibold ${result.ok ? 'text-good' : 'text-bad'}`}>
              {result.ok ? '✓ ' : ''}
              {result.text}
            </p>
            {!result.ok && <p className="mt-1 text-sm text-muted">Nothing was saved. Check the Shortcut’s link in Settings → Steps.</p>}
            <Button variant="primary" className="mt-3 w-full" onClick={() => navigate('/', { replace: true })}>
              Back to Today
            </Button>
          </>
        )}
      </Card>
    </Screen>
  )
}
