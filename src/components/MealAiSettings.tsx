import { useId, useState } from 'react'
import { setApiKey, useHasApiKey } from '../db/meals'
import { DEFAULT_FOOD_NOTES } from '../db/defaults'
import { updateSettings } from '../db/repo'
import type { Settings } from '../types'
import { Button, Card, Stepper } from './ui'

export function MealAiSettings({ settings }: { settings: Settings }) {
  const hasKey = useHasApiKey()
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const keyId = useId()
  const notesId = useId()

  return (
    <Card className="space-y-3" >
      <div>
        <p className="text-sm font-medium">Claude API key</p>
        {hasKey ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 text-sm text-good">✓ Connected. The key is stored only on this phone and never included in backups.</span>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('Remove the API key from this phone?')) void setApiKey('')
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted">
              Needed for meal photos, meal ideas and grocery lists. Get one at console.anthropic.com → API Keys (add a few dollars of credit under Billing first). Meal photos you analyze are sent to Anthropic; progress photos never leave the phone.
            </p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void setApiKey(key).then(() => {
                  setKey('')
                  setSaved(true)
                })
              }}
            >
              <label htmlFor={keyId} className="sr-only">
                API key
              </label>
              <input
                id={keyId}
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-ant-…"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3"
              />
              <Button type="submit" variant="primary" disabled={!key.trim().startsWith('sk-ant-')}>
                Save
              </Button>
            </form>
            {key.trim() && !key.trim().startsWith('sk-ant-') && <p className="mt-1 text-xs text-warn">API keys start with “sk-ant-”.</p>}
          </>
        )}
        {saved && hasKey && <p className="mt-1 text-sm text-good">Saved.</p>}
      </div>

      <div>
        <label htmlFor={notesId} className="text-sm font-medium">
          Food notes <span className="text-muted">(health, dislikes, allergies, budget)</span>
        </label>
        <textarea
          id={notesId}
          key={settings.foodNotes}
          defaultValue={settings.foodNotes}
          rows={5}
          onBlur={(e) => {
            if (e.target.value !== settings.foodNotes) void updateSettings({ foodNotes: e.target.value })
          }}
          className="mt-1 w-full rounded-xl border border-line bg-surface-2 p-3 text-sm"
        />
        {settings.foodNotes !== DEFAULT_FOOD_NOTES && (
          <Button variant="ghost" className="text-sm" onClick={() => void updateSettings({ foodNotes: DEFAULT_FOOD_NOTES })}>
            Reset to the heart-healthy default
          </Button>
        )}
      </div>
      <Stepper label="People eating dinner" value={settings.householdSize} min={1} max={10} onChange={(householdSize) => void updateSettings({ householdSize })} />
      <Stepper label="Saturated fat limit" suffix="g" value={settings.satFatLimitG} min={5} max={40} onChange={(satFatLimitG) => void updateSettings({ satFatLimitG })} />
      <Stepper label="Fiber target" suffix="g" value={settings.fiberTargetG} min={10} max={60} onChange={(fiberTargetG) => void updateSettings({ fiberTargetG })} />
    </Card>
  )
}
