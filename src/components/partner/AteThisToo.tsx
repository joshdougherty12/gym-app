import { useState } from 'react'
import { saveMeal } from '../../db/meals'
import { todayIso } from '../../lib/dates'
import { timestamp } from '../../lib/id'
import { MEAL_LABEL, mealTypeForTime } from '../../lib/meals'
import type { SharedRecipeNutrition } from '../../lib/partner/types'
import { mealFromRecipe, type RecipeDraft } from '../../lib/recipes'
import { markEventSeen } from '../../partner/engine'
import { usePartner, usePartnerInbox, usePortions, type InboxEvent } from '../../partner/hooks'
import { ago } from '../../partner/present'
import { Button, Card, Stepper } from '../ui'

function draftFrom(r: SharedRecipeNutrition): RecipeDraft {
  return { ...r, servings: 1, ingredients: [], steps: [] }
}

/** Food screen: "Sam ate Salmon bowls. Log it too?" One tap logs a meal with this phone's own portion. */
export function AteThisToo({ toast }: { toast: (msg: string) => void }) {
  const inbox = usePartnerInbox(['atethis'])
  const p = usePartner()
  const portions = usePortions()
  if (!inbox?.length || !p?.link) return null
  return (
    <div className="mt-3 space-y-2">
      {inbox.map((e) => (
        <AteCard key={`${e.row.key}-${portions?.split.mine ?? 1}`} event={e} partnerName={p.partnerName} defaultServings={portions?.split.mine ?? 1} toast={toast} />
      ))}
    </div>
  )
}

function AteCard({ event, partnerName, defaultServings, toast }: { event: InboxEvent; partnerName: string; defaultServings: number; toast: (msg: string) => void }) {
  const [servings, setServings] = useState(defaultServings)
  const [busy, setBusy] = useState(false)
  if (event.data.kind !== 'atethis') return null
  const recipe = draftFrom(event.data.recipe)
  const at = new Date(event.data.at)
  const mealType = mealTypeForTime(at)
  const date = todayIso(at)
  const preview = mealFromRecipe(recipe, { servings, date, mealType })
  return (
    <Card className="space-y-2 border-accent">
      <p>
        <span className="font-semibold">
          {partnerName} ate {recipe.name}
        </span>{' '}
        <span className="text-sm text-muted">· {ago(event.data.at, timestamp())}</span>
      </p>
      <p className="text-sm text-muted">Did you eat it too? Log your own portion.</p>
      <Stepper label="Your servings" value={servings} step={0.1} min={0.1} max={10} onChange={setServings} />
      <p className="num text-lg">
        {preview.calories} kcal · {preview.proteinG} g P <span className="text-sm text-muted">· {MEAL_LABEL[mealType]}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          disabled={busy || !(servings > 0)}
          onClick={() => {
            setBusy(true)
            void saveMeal(mealFromRecipe(recipe, { servings, date, mealType }))
              .then(() => markEventSeen(event.row.key))
              .then(() => toast(`Logged to ${MEAL_LABEL[mealType].toLowerCase()}`))
              .finally(() => setBusy(false))
          }}
        >
          Log it too
        </Button>
        <Button onClick={() => void markEventSeen(event.row.key)}>Not me</Button>
      </div>
    </Card>
  )
}
