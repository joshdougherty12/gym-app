import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TargetBar } from '../components/charts'
import { Icon } from '../components/Icon'
import { AteThisToo } from '../components/partner/AteThisToo'
import { LogRecipeSheet, RecipeActions, RecipeDetails, SavedRecipesSheet, useToast } from '../components/Recipes'
import { Badge, Button, Card, Loading, Screen, SectionTitle, Segmented, Sheet, Stepper } from '../components/ui'
import { deleteMeal, getApiKey, saveMeal, setCache, useCache, useHasApiKey, useMealsForDate } from '../db/meals'
import { useRecipes } from '../db/recipes'
import { useSettings } from '../db/repo'
import { AiError, estimateMeal, estimateMealFromText, suggestMeals } from '../lib/ai/claude'
import type { MealEstimate, MealIdea } from '../lib/ai/schemas'
import { addDays, shortDate, todayIso, WEEKDAY_SHORT, weekdayOf } from '../lib/dates'
import { newId, timestamp } from '../lib/id'
import { compressImage } from '../lib/image'
import { MEAL_LABEL, MEAL_TYPES, mealTypeForTime, nextMealType, scaleMeal, sumMeals } from '../lib/meals'
import { recipeFromIdea, type RecipeDraft } from '../lib/recipes'
import type { Meal, MealType, Settings } from '../types'

const r = (n: number) => Math.round(n)

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

/** A meal from Claude's estimate. A text estimate (`keep` given) updates the meal being edited in place. */
function fromEstimate(e: MealEstimate, date: string, mealType: MealType, photo: Blob | undefined, keep?: Pick<Meal, 'id' | 'loggedAt'>): Meal {
  return {
    id: keep?.id ?? newId('meal'),
    date,
    loggedAt: keep?.loggedAt ?? timestamp(),
    mealType,
    name: e.mealName,
    items: e.items.map((i) => ({ name: i.name, portion: i.portion, calories: r(i.calories), proteinG: r(i.proteinG), satFatG: Math.round(i.satFatG * 10) / 10, fiberG: Math.round(i.fiberG * 10) / 10 })),
    calories: r(e.totals.calories),
    proteinG: r(e.totals.proteinG),
    carbsG: r(e.totals.carbsG),
    fatG: r(e.totals.fatG),
    satFatG: Math.round(e.totals.satFatG * 10) / 10,
    fiberG: Math.round(e.totals.fiberG * 10) / 10,
    confidence: e.confidence,
    notes: [e.assumptions, e.heartTip].filter(Boolean).join(' '),
    ...(photo ? { photo } : {}),
    source: keep ? 'text' : 'photo',
  }
}

export function FoodScreen() {
  const settings = useSettings()
  const hasKey = useHasApiKey()
  const [date, setDate] = useState(todayIso())
  const meals = useMealsForDate(date)
  const [editing, setEditing] = useState<Meal | null>(null)
  const [analyzing, setAnalyzing] = useState<{ thumb: Blob; big: Blob; note: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileId = useId()
  const galleryId = useId()
  const today = todayIso()
  const [logging, setLogging] = useState<{ recipe: RecipeDraft; mealType: MealType; share: boolean } | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [toastNode, toast] = useToast()
  const saved = useRecipes()

  if (!settings || !meals || hasKey === undefined) return <Loading />
  const t = sumMeals(meals)

  const analyze = async (big: Blob, thumb: Blob, note: string) => {
    setError(null)
    setAnalyzing({ big, thumb, note })
    try {
      const key = await getApiKey()
      if (!key) throw new AiError('Add your Claude API key in Settings → Meal AI first.')
      const est = await estimateMeal(key, settings, big, note)
      if (!est.isFood) throw new AiError('That doesn’t look like food. Try another photo, or add the meal without a photo.')
      const type = date === today ? mealTypeForTime(new Date()) : 'dinner'
      setEditing(fromEstimate(est, date, type, thumb))
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not analyze the photo. Try again.')
    } finally {
      setAnalyzing(null)
    }
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    const [big, thumb] = await Promise.all([compressImage(file, 1568, 0.85), compressImage(file, 480, 0.8)])
    await analyze(big, thumb, '')
  }

  const describeMeal = async (text: string): Promise<MealEstimate> => {
    const key = await getApiKey()
    if (!key) throw new AiError('Add your Claude API key in Settings → Meal AI first.')
    const est = await estimateMealFromText(key, settings, text)
    if (!est.isFood) throw new AiError('That doesn’t sound like food. Describe what you ate and try again.')
    return est
  }

  const manual = () =>
    setEditing({ id: newId('meal'), date, loggedAt: timestamp(), mealType: date === today ? mealTypeForTime(new Date()) : 'dinner', name: '', items: [], calories: 0, proteinG: 0, source: 'manual' })

  return (
    <Screen
      title="Food"
      subtitle={
        <span className="inline-flex items-center gap-1">
          <button type="button" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} className="grid size-9 place-items-center rounded-full">
            <Icon name="chevronLeft" className="size-5" />
          </button>
          <span className="min-w-24 text-center">{date === today ? 'Today' : `${WEEKDAY_SHORT[weekdayOf(date)]} ${shortDate(date)}`}</span>
          <button type="button" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} className="grid size-9 place-items-center rounded-full disabled:opacity-30">
            <Icon name="chevronRight" className="size-5" />
          </button>
        </span>
      }
    >
      {!hasKey && (
        <Card className="mb-3 border-accent">
          <p className="font-semibold">Connect Claude to estimate meals from photos</p>
          <p className="mt-1 text-sm text-muted">Paste an Anthropic API key in Settings → Meal AI. You can still log meals by hand.</p>
          <Link to="/settings" className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-accent font-bold text-accent-ink">
            Open Settings
          </Link>
        </Card>
      )}

      <Card className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">{t.count} meal{t.count === 1 ? '' : 's'} logged</p>
          <p className="num text-lg">{Math.max(0, settings.calorieTarget - r(t.calories)).toLocaleString()} kcal left</p>
        </div>
        <TargetBar label="Calories" value={t.calories} max={Math.max(settings.calorieTarget * 1.2, t.calories)} target={settings.calorieTarget} display={r(t.calories).toLocaleString()} tone={t.calories > settings.calorieTarget ? 'warn' : 'accent'} />
        <TargetBar label="Protein" value={t.proteinG} max={Math.max(settings.proteinTargetG * 1.2, t.proteinG)} target={settings.proteinTargetG} display={`${r(t.proteinG)} g`} tone={t.proteinG >= settings.proteinTargetG ? 'good' : 'accent'} />
        <TargetBar label="Sat. fat" value={t.satFatG} max={Math.max(settings.satFatLimitG * 1.5, t.satFatG)} target={settings.satFatLimitG} display={`${r(t.satFatG)} g`} tone={t.satFatG > settings.satFatLimitG ? 'warn' : 'good'} />
        <TargetBar label="Fiber" value={t.fiberG} max={Math.max(settings.fiberTargetG * 1.2, t.fiberG)} target={settings.fiberTargetG} display={`${r(t.fiberG)} g`} tone={t.fiberG >= settings.fiberTargetG ? 'good' : 'accent'} />
        <p className="text-xs text-muted">Photo numbers are Claude’s estimates. Saturated fat limit {settings.satFatLimitG} g/day (heart-healthy guideline; follow your doctor’s advice).</p>
      </Card>

      {date === today && <AteThisToo toast={toast} />}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label htmlFor={fileId} className={`col-span-2 flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-bold tracking-wide text-accent-ink uppercase ${!hasKey || analyzing ? 'pointer-events-none opacity-40' : ''}`}>
          <Icon name="camera" /> Snap a meal
        </label>
        <label htmlFor={galleryId} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface-2 px-3 font-semibold text-ink ${!hasKey || analyzing ? 'pointer-events-none opacity-40' : ''}`}>
          <Icon name="photo" className="size-5" /> Pick from gallery
        </label>
        <Button className="flex min-h-12 items-center justify-center gap-2" onClick={manual}>
          <Icon name="plus" className="size-5" /> Add by hand
        </Button>
      </div>
      {[fileId, galleryId].map((id) => (
        <input
          key={id}
          id={id}
          type="file"
          accept="image/*"
          capture={id === fileId ? 'environment' : undefined}
          className="sr-only"
          onChange={(e) => {
            void onPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      ))}

      {analyzing && <AnalyzingCard thumb={analyzing.thumb} />}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-bad/10 p-3 text-sm text-bad">
          {error}
        </p>
      )}

      {MEAL_TYPES.map((mt) => {
        const list = meals.filter((m) => m.mealType === mt)
        if (!list.length) return null
        return (
          <div key={mt}>
            <SectionTitle>{MEAL_LABEL[mt]}</SectionTitle>
            <ul className="space-y-2">
              {list.map((m) => (
                <li key={m.id}>
                  <MealRow meal={m} onOpen={() => setEditing(m)} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {meals.length === 0 && <p className="mt-4 text-center text-sm text-muted">Nothing logged {date === today ? 'yet today' : 'this day'}.</p>}

      {hasKey && date === today && <Ideas settings={settings} date={date} meals={meals} toast={toast} onLog={(recipe, mealType) => setLogging({ recipe, mealType, share: false })} />}

      <button type="button" onClick={() => setSavedOpen(true)} className="mt-6 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left">
        <Icon name="book" className="size-7 text-accent" />
        <span className="flex-1">
          <span className="block font-bold">Saved recipes</span>
          <span className="block text-sm text-muted">{saved?.length ? `${saved.length} saved · log, share or copy` : 'Save any recipe Claude suggests'}</span>
        </span>
        <Icon name="chevronRight" className="size-5 text-muted" />
      </button>

      <Link to="/food/plan" className="mt-2 flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4">
        <Icon name="cart" className="size-7 text-accent" />
        <span className="flex-1">
          <span className="block font-bold">Plan the week</span>
          <span className="block text-sm text-muted">Pick dinners, get one grocery list to send</span>
        </span>
        <Icon name="chevronRight" className="size-5 text-muted" />
      </Link>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.name || 'Meal'}>
        {editing && (
          <MealEditor
            key={editing.id}
            meal={editing}
            canReanalyze={!!editing.photo && editing.source === 'photo' && !!hasKey}
            onReanalyze={(note) => {
              const thumb = editing.photo
              setEditing(null)
              if (thumb) void analyze(thumb, thumb, note)
            }}
            canDescribe={!!hasKey}
            onDescribe={describeMeal}
            onSave={(m) => void saveMeal(m).then(() => setEditing(null))}
            onDelete={() => void deleteMeal(editing.id).then(() => setEditing(null))}
          />
        )}
      </Sheet>

      <SavedRecipesSheet
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        toast={toast}
        onLog={(recipe) => {
          setSavedOpen(false)
          setLogging({ recipe, mealType: date === today ? mealTypeForTime(new Date()) : 'dinner', share: true })
        }}
      />
      <LogRecipeSheet
        recipe={logging?.recipe ?? null}
        date={date}
        defaultMealType={logging?.mealType ?? 'dinner'}
        share={logging?.share ?? false}
        onClose={() => setLogging(null)}
        onLogged={(msg) => {
          setLogging(null)
          toast(msg)
        }}
      />
      {toastNode}
    </Screen>
  )
}

function AnalyzingCard({ thumb }: { thumb: Blob }) {
  const url = useObjectUrl(thumb)
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3" role="status">
      {url && <img src={url} alt="" className="size-16 rounded-xl object-cover" />}
      <div>
        <p className="font-semibold">Claude is looking at your meal…</p>
        <p className="text-sm text-muted">Usually 5-20 seconds.</p>
      </div>
    </div>
  )
}

function MealRow({ meal, onOpen }: { meal: Meal; onOpen: () => void }) {
  const url = useObjectUrl(meal.photo)
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left">
      {url ? <img src={url} alt="" className="size-14 shrink-0 rounded-xl object-cover" /> : <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><Icon name="food" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{meal.name || 'Meal'}</span>
        <span className="num block text-lg">
          {r(meal.calories)} kcal · {r(meal.proteinG)} g P{meal.satFatG !== undefined ? ` · ${meal.satFatG} g SF` : ''}
        </span>
      </span>
      {(meal.source === 'photo' || meal.source === 'text') && meal.confidence && <Badge tone={meal.confidence === 'high' ? 'good' : meal.confidence === 'low' ? 'warn' : 'muted'}>{meal.confidence}</Badge>}
    </button>
  )
}

function MealEditor({
  meal,
  onSave,
  onDelete,
  canReanalyze,
  onReanalyze,
  canDescribe,
  onDescribe,
}: {
  meal: Meal
  onSave: (m: Meal) => void
  onDelete: () => void
  canReanalyze: boolean
  onReanalyze: (note: string) => void
  canDescribe: boolean
  onDescribe: (text: string) => Promise<MealEstimate>
}) {
  const [m, setM] = useState<Meal>(meal)
  const [note, setNote] = useState('')
  const [said, setSaid] = useState('')
  const [describing, setDescribing] = useState(false)
  const [describeErr, setDescribeErr] = useState<string | null>(null)
  const nameId = useId()
  const noteId = useId()
  const saidId = useId()
  const url = useObjectUrl(meal.photo)
  const showDescribe = meal.source === 'manual' || meal.source === 'text'

  const describe = async () => {
    const text = said.trim()
    if (!text) return
    setDescribing(true)
    setDescribeErr(null)
    try {
      const est = await onDescribe(text)
      const next = fromEstimate(est, m.date, m.mealType, undefined, m)
      setM({ ...next, name: m.name.trim() || next.name, notes: [`You said: ${text}.`, next.notes].filter(Boolean).join(' ') })
    } catch (e) {
      setDescribeErr(e instanceof AiError ? e.message : 'Could not estimate that. Try again.')
    } finally {
      setDescribing(false)
    }
  }

  return (
    <div className="space-y-3">
      {url && <img src={url} alt="Meal photo" className="max-h-56 w-full rounded-xl object-cover" />}
      {showDescribe && (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <label htmlFor={saidId} className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
            Describe what you ate
          </label>
          <textarea
            id={saidId}
            value={said}
            onChange={(e) => setSaid(e.target.value)}
            rows={3}
            placeholder="e.g. two eggs scrambled with spinach, one slice whole wheat toast with butter, black coffee"
            className="w-full rounded-xl border border-line bg-surface-2 p-3"
          />
          <Button className="flex w-full items-center justify-center gap-2" disabled={!canDescribe || describing || !said.trim()} onClick={() => void describe()}>
            <Icon name="sparkle" className="size-5" /> {describing ? 'Claude is estimating…' : 'Estimate with Claude'}
          </Button>
          {!canDescribe && <p className="text-xs text-muted">Add your Claude API key in Settings → Meal AI to estimate from a description. You can still enter the numbers below.</p>}
          {describeErr && (
            <p role="alert" className="text-sm text-bad">
              {describeErr}
            </p>
          )}
          {canDescribe && !describeErr && <p className="text-xs text-muted">Or enter the numbers yourself below. You can adjust Claude’s estimate before saving.</p>}
        </div>
      )}
      <div>
        <label htmlFor={nameId} className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
          Name
        </label>
        <input id={nameId} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="e.g. Turkey sandwich" className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3" />
      </div>
      <Segmented label="Meal" value={m.mealType} onChange={(mealType) => setM({ ...m, mealType })} options={MEAL_TYPES.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
      <Stepper label="Calories" suffix="kcal" value={r(m.calories)} step={25} min={0} max={5000} onChange={(calories) => setM({ ...m, calories })} />
      <Stepper label="Protein" suffix="g" value={r(m.proteinG)} step={5} min={0} max={400} onChange={(proteinG) => setM({ ...m, proteinG })} />
      <Stepper label="Saturated fat" suffix="g" value={m.satFatG ?? 0} step={1} min={0} max={200} onChange={(satFatG) => setM({ ...m, satFatG })} />
      <Stepper label="Fiber" suffix="g" value={m.fiberG ?? 0} step={1} min={0} max={200} onChange={(fiberG) => setM({ ...m, fiberG })} />
      {m.items.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.14em] text-muted uppercase">Portion eaten</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[0.5, 0.75, 1.25, 1.5].map((f) => (
              <Button key={f} onClick={() => setM(scaleMeal(m, f))}>
                ×{f}
              </Button>
            ))}
          </div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {m.items.map((i, k) => (
              <li key={k} className="flex gap-2 py-1.5">
                <span className="min-w-0 flex-1">
                  {i.name} <span className="text-muted">· {i.portion}</span>
                </span>
                <span className="num text-base">{r(i.calories)} kcal</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {m.notes && <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">{m.notes}</p>}
      {canReanalyze && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor={noteId} className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
              Correct Claude
            </label>
            <input id={noteId} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. no cheese, 2 eggs, cooked in butter" className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3" />
          </div>
          <Button disabled={!note.trim()} onClick={() => onReanalyze(note.trim())}>
            Re-estimate
          </Button>
        </div>
      )}
      <Button variant="primary" className="w-full" disabled={!m.name.trim() && m.calories === 0} onClick={() => onSave({ ...m, name: m.name.trim() || 'Meal' })}>
        Save meal
      </Button>
      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          if (window.confirm('Delete this meal?')) onDelete()
        }}
      >
        Delete
      </Button>
    </div>
  )
}

function Ideas({ settings, date, meals, toast, onLog }: { settings: Settings; date: string; meals: Meal[]; toast: (msg: string) => void; onLog: (r: RecipeDraft, mealType: MealType) => void }) {
  const [type, setType] = useState<MealType>(() => nextMealType(new Date()))
  const cacheId = `ideas:${date}:${type}`
  const { data: ideas } = useCache<MealIdea[]>(cacheId)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const load = async (more: boolean) => {
    setBusy(true)
    setErr(null)
    try {
      const key = await getApiKey()
      if (!key) throw new AiError('Add your API key in Settings → Meal AI.')
      const t = sumMeals(meals)
      const next = await suggestMeals(key, settings, {
        mealType: type,
        eatenCalories: t.calories,
        eatenProteinG: t.proteinG,
        eatenSatFatG: t.satFatG,
        eatenFiberG: t.fiberG,
        mealsEaten: meals.map((m) => `${MEAL_LABEL[m.mealType]}: ${m.name}`),
        avoid: more ? (ideas ?? []).map((i) => i.name) : [],
      })
      await setCache(cacheId, next)
      setOpen(null)
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'Could not get ideas. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionTitle>What should I eat?</SectionTitle>
      <Card className="space-y-3">
        <Segmented label="Meal" value={type} onChange={(v) => { setType(v); setOpen(null) }} options={MEAL_TYPES.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
        {!ideas && (
          <Button variant="primary" className="w-full" disabled={busy} onClick={() => void load(false)}>
            {busy ? 'Thinking…' : `Ideas for ${MEAL_LABEL[type].toLowerCase()}`}
          </Button>
        )}
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        {ideas && (
          <>
            <ul className="space-y-2">
              {ideas.map((i, k) => (
                <li key={i.name} className="rounded-xl bg-surface-2 p-3">
                  <button type="button" onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k} className="w-full text-left">
                    <span className="block font-semibold">{i.name}</span>
                    <span className="num block text-lg">
                      {r(i.calories)} kcal · {r(i.proteinG)} g P · {i.satFatG} g SF · ~${i.estCostUsd.toFixed(2)} · {r(i.prepMinutes)} min
                    </span>
                    <span className="block text-sm text-muted">{i.why}</span>
                  </button>
                  {open === k && (
                    <div className="mt-2">
                      <RecipeDetails recipe={recipeFromIdea(i)} />
                      <RecipeActions recipe={recipeFromIdea(i)} toast={toast} onLog={() => onLog(recipeFromIdea(i), type)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Button className="w-full" disabled={busy} onClick={() => void load(true)}>
              {busy ? 'Thinking…' : 'Different ideas'}
            </Button>
          </>
        )}
      </Card>
    </>
  )
}
