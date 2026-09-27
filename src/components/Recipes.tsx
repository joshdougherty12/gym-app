import { useEffect, useRef, useState } from 'react'
import { saveMeal } from '../db/meals'
import { deleteRecipe, saveRecipe, useRecipes } from '../db/recipes'
import { shortDate, todayIso, WEEKDAY_SHORT, weekdayOf } from '../lib/dates'
import { MEAL_LABEL, MEAL_TYPES } from '../lib/meals'
import { mealFromRecipe, perServingLine, recipeText, sameRecipe, type RecipeDraft } from '../lib/recipes'
import { copyText, shareText } from '../lib/shareText'
import type { MealType, Recipe } from '../types'
import { Icon } from './Icon'
import { Button, Segmented, Sheet, Stepper } from './ui'
import { PortionLine } from './partner/PortionLine'
import { sendEvent } from '../partner/engine'
import { usePartner, usePortions } from '../partner/hooks'
import { timestamp } from '../lib/id'

/** A short confirmation that disappears on its own and leaves the user where they were. */
export function useToast(): [React.ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // A popover sits in the top layer, so the message also shows above an open sheet.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.showPopover !== 'function') return
    try {
      if (msg && !el.matches(':popover-open')) el.showPopover()
      if (!msg && el.matches(':popover-open')) el.hidePopover()
    } catch {
      /* popover unsupported: the message still renders in place */
    }
  }, [msg])
  const show = (m: string) => {
    window.clearTimeout(timer.current)
    setMsg(m)
    timer.current = window.setTimeout(() => setMsg(null), 2500)
  }
  const node = (
    <div ref={ref} popover="manual" role="status" aria-live="polite" className="pointer-events-none mt-auto mb-24 max-w-[90vw] border-0 bg-transparent p-0">
      {msg && <p className="rounded-xl bg-ink px-4 py-2 text-center text-sm font-semibold text-bg shadow-lg">{msg}</p>}
    </div>
  )
  return [node, show]
}

/** Per-serving numbers, ingredients, steps and tip. */
export function RecipeDetails({ recipe }: { recipe: RecipeDraft }) {
  return (
    <div className="text-sm">
      <p className="text-muted">
        Per serving{recipe.servings !== 1 ? ` (serves ${recipe.servings})` : ''}: {perServingLine(recipe)}
      </p>
      <PortionLine />
      <p className="mt-2 font-semibold">You need</p>
      <ul className="list-disc pl-5">
        {recipe.ingredients.map((x, k) => (
          <li key={k}>{x}</li>
        ))}
      </ul>
      <p className="mt-2 font-semibold">Steps</p>
      <ol className="list-decimal space-y-1 pl-5">
        {recipe.steps.map((x, k) => (
          <li key={k}>{x}</li>
        ))}
      </ol>
      {recipe.tip && <p className="mt-2 text-muted">Tip: {recipe.tip}</p>}
    </div>
  )
}

/**
 * "I ate this", then Save (or Delete for a saved recipe), Share and Copy.
 * Share and Copy send clean plain text.
 */
export function RecipeActions({ recipe, onLog, onDelete, toast }: { recipe: RecipeDraft; onLog: () => void; onDelete?: () => void; toast: (msg: string) => void }) {
  const saved = useRecipes()
  const isSaved = !!saved?.some((x) => sameRecipe(x.name, recipe.name))
  const small = 'flex min-h-11 items-center justify-center gap-1.5 border border-line px-2 text-sm'
  return (
    <div className="mt-3 space-y-2">
      <Button variant="primary" className="w-full" onClick={onLog}>
        I ate this
      </Button>
      <div className="grid grid-cols-3 gap-2">
        {onDelete ? (
          <Button
            variant="danger"
            className={small}
            onClick={() => {
              if (window.confirm(`Delete "${recipe.name}" from saved recipes?`)) onDelete()
            }}
          >
            <Icon name="trash" className="size-4" /> Delete
          </Button>
        ) : (
          <Button className={small} disabled={isSaved} onClick={() => void saveRecipe(recipe).then(() => toast('Recipe saved'))}>
            <Icon name={isSaved ? 'check' : 'bookmark'} className="size-4" /> {isSaved ? 'Saved' : 'Save'}
          </Button>
        )}
        <Button
          className={small}
          onClick={() =>
            void shareText(recipe.name, recipeText(recipe)).then((res) => {
              if (res === 'copied') toast('Copied. Paste it anywhere.')
              else if (res === 'failed') toast('Could not share. Try Copy.')
            })
          }
        >
          <Icon name="share" className="size-4" /> Share
        </Button>
        <Button className={small} onClick={() => void copyText(recipeText(recipe)).then((ok) => toast(ok ? 'Recipe copied' : 'Could not copy'))}>
          <Icon name="copy" className="size-4" /> Copy
        </Button>
      </div>
    </div>
  )
}

/** Optional per-serving numbers a recipe has. */
function pick(r: RecipeDraft) {
  const out: { satFatG?: number; fiberG?: number; carbsG?: number; fatG?: number } = {}
  for (const k of ['satFatG', 'fiberG', 'carbsG', 'fatG'] as const) {
    const v = r[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

const dayLabel = (date: string) => (date === todayIso() ? 'today' : `${WEEKDAY_SHORT[weekdayOf(date)]} ${shortDate(date)}`)

/**
 * Log a recipe as a meal: pick servings and meal. Uses the recipe's own numbers, no AI call.
 * With `share` (week-plan and saved recipes) and a linked partner, the partner gets a
 * one-tap "Log it too" card: recipe name and per-serving numbers only, not your servings.
 */
export function LogRecipeSheet({ recipe, date, defaultMealType, onClose, onLogged, share = false }: { recipe: RecipeDraft | null; date: string; defaultMealType: MealType; onClose: () => void; onLogged: (msg: string) => void; share?: boolean }) {
  const portions = usePortions()
  const partner = usePartner()
  const shareWith = share && partner?.link?.status === 'linked' ? partner.partnerName : null
  return (
    <Sheet open={!!recipe} onClose={onClose} title="I ate this">
      {recipe && <LogRecipeForm key={recipe.name} recipe={recipe} date={date} defaultMealType={defaultMealType} onLogged={onLogged} defaultServings={portions?.split.mine ?? 1} shareWith={shareWith} />}
    </Sheet>
  )
}

function LogRecipeForm({ recipe, date, defaultMealType, onLogged, defaultServings, shareWith }: { recipe: RecipeDraft; date: string; defaultMealType: MealType; onLogged: (msg: string) => void; defaultServings: number; shareWith: string | null }) {
  const [servings, setServings] = useState(defaultServings)
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [busy, setBusy] = useState(false)
  const preview = mealFromRecipe(recipe, { servings, date, mealType })
  return (
    <div className="space-y-3">
      <p className="font-semibold">{recipe.name}</p>
      <Stepper label="Servings" value={servings} step={0.5} min={0.5} max={20} onChange={setServings} />
      <Segmented label="Meal" value={mealType} onChange={setMealType} options={MEAL_TYPES.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
      <p className="rounded-xl bg-surface-2 p-3 text-sm">
        <span className="num block text-lg">
          {preview.calories} kcal · {preview.proteinG} g P{preview.satFatG !== undefined ? ` · ${preview.satFatG} g SF` : ''}
          {preview.fiberG !== undefined ? ` · ${preview.fiberG} g fiber` : ''}
        </span>
        <span className="text-muted">
          {MEAL_LABEL[mealType]}, {dayLabel(date)}. You can adjust it after.{shareWith ? ` ${shareWith} will get a “log it too” card.` : ''}
        </span>
      </p>
      <Button
        variant="primary"
        className="w-full"
        disabled={busy || !(servings > 0)}
        onClick={() => {
          setBusy(true)
          void saveMeal(mealFromRecipe(recipe, { servings, date, mealType }))
            .then(async () => {
              const shared =
                shareWith !== null &&
                (await sendEvent({
                  kind: 'atethis',
                  at: timestamp(),
                  recipe: { name: recipe.name, calories: recipe.calories, proteinG: recipe.proteinG, ...pick(recipe) },
                }).catch(() => false))
              onLogged(`Logged to ${MEAL_LABEL[mealType].toLowerCase()}${shared ? ` · ${shareWith} can log it too` : ''}`)
            })
            .finally(() => setBusy(false))
        }}
      >
        Log meal
      </Button>
    </div>
  )
}

/** The saved-recipes list: tap one to see it, log it, share, copy or delete it. */
export function SavedRecipesSheet({ open, onClose, onLog, toast }: { open: boolean; onClose: () => void; onLog: (r: Recipe) => void; toast: (msg: string) => void }) {
  const recipes = useRecipes()
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <Sheet open={open} onClose={onClose} title="Saved recipes">
      {recipes && recipes.length === 0 && <p className="py-4 text-center text-sm text-muted">No saved recipes yet. Tap Save on any recipe Claude suggests.</p>}
      <ul className="space-y-2">
        {recipes?.map((r) => {
          const isOpen = openId === r.id
          return (
            <li key={r.id} className="rounded-xl bg-surface-2 p-3">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : r.id)} className="flex min-h-11 w-full items-center gap-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="num block text-base text-muted">
                    {r.calories} kcal · {r.proteinG} g P per serving{r.prepMinutes ? ` · ${r.prepMinutes} min` : ''}
                  </span>
                </span>
                <Icon name="chevronDown" className={`size-5 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="mt-2">
                  <RecipeDetails recipe={r} />
                  <RecipeActions recipe={r} toast={toast} onLog={() => onLog(r)} onDelete={() => void deleteRecipe(r.id).then(() => toast('Recipe deleted'))} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
