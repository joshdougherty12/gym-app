import { useId, useState } from 'react'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, Loading, Screen, SectionTitle } from '../components/ui'
import { getApiKey, setCache, useCache, useHasApiKey } from '../db/meals'
import { useSettings } from '../db/repo'
import { AiError, groceryPlan, weekIdeas } from '../lib/ai/claude'
import type { GroceryPlan, WeekIdea } from '../lib/ai/schemas'
import { groceryText } from '../lib/meals'
import { shareText } from '../lib/shareText'

interface WeekPlan {
  ideas: WeekIdea[]
  selected: string[]
  notes: string
  grocery?: GroceryPlan
  groceryFor?: string[]
  checked: string[]
}

const CACHE_ID = 'weekplan'
const EMPTY: WeekPlan = { ideas: [], selected: [], notes: '', checked: [] }

export function PlanScreen() {
  const settings = useSettings()
  const hasKey = useHasApiKey()
  const { data, loaded } = useCache<WeekPlan>(CACHE_ID)
  const [busy, setBusy] = useState<'ideas' | 'list' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const notesId = useId()

  if (!settings || !loaded || hasKey === undefined) return <Loading />
  const plan: WeekPlan = { ...EMPTY, ...data }
  const save = (p: WeekPlan) => void setCache(CACHE_ID, p)
  const chosen = plan.ideas.filter((i) => plan.selected.includes(i.id))
  const listIsStale = !!plan.grocery && (plan.groceryFor ?? []).join('|') !== plan.selected.join('|')

  const run = async (kind: 'ideas' | 'list', fn: (key: string) => Promise<void>) => {
    setBusy(kind)
    setErr(null)
    try {
      const key = await getApiKey()
      if (!key) throw new AiError('Add your API key in Settings → Meal AI.')
      await fn(key)
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const getIdeas = (more: boolean) =>
    run('ideas', async (key) => {
      const fresh = await weekIdeas(key, settings, { count: 10, avoid: more ? plan.ideas.map((i) => i.name) : [] })
      // Keep ids unique across batches.
      const taken = new Set(plan.ideas.map((i) => i.id))
      const renamed = fresh.map((i, k) => (taken.has(i.id) ? { ...i, id: `${i.id}-${Date.now().toString(36)}-${k}` } : i))
      save(more ? { ...plan, ideas: [...plan.ideas, ...renamed] } : { ...EMPTY, notes: plan.notes, ideas: renamed })
    })

  const makeList = () =>
    run('list', async (key) => {
      const g = await groceryPlan(key, settings, chosen, plan.notes)
      save({ ...plan, grocery: g, groceryFor: [...plan.selected], checked: [] })
    })

  const toggle = (id: string) => save({ ...plan, selected: plan.selected.includes(id) ? plan.selected.filter((x) => x !== id) : [...plan.selected, id] })
  const toggleItem = (k: string) => save({ ...plan, checked: plan.checked.includes(k) ? plan.checked.filter((x) => x !== k) : [...plan.checked, k] })

  const share = async (what: 'list' | 'recipes') => {
    if (!plan.grocery) return
    const names = chosen.map((c) => c.name)
    const text =
      what === 'list'
        ? groceryText(plan.grocery, names)
        : plan.grocery.recipes.map((rc) => [rc.name.toUpperCase(), `Serves ${rc.servings}`, '', ...rc.ingredients.map((i) => `• ${i}`), '', ...rc.steps.map((s, k) => `${k + 1}. ${s}`), rc.tip ? `Tip: ${rc.tip}` : ''].join('\n')).join('\n\n———\n\n')
    const res = await shareText(what === 'list' ? 'Grocery list' : 'This week’s recipes', text)
    setMsg(res === 'copied' ? 'Copied. Paste it into a text message.' : res === 'failed' ? 'Could not share. Try again.' : null)
  }

  return (
    <Screen title="Plan the week" subtitle="Pick dinners, get one grocery list" back="/food">
      {!hasKey && (
        <Card className="mb-3 border-accent">
          <p className="text-sm">Add your Claude API key in Settings → Meal AI to plan meals.</p>
        </Card>
      )}

      {plan.ideas.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Claude suggests about 10 heart-healthy, budget-friendly dinners for {settings.householdSize} people, with enough variety for someone who loves to cook. You pick the ones you want.
          </p>
          <Button variant="primary" className="mt-3 w-full" disabled={!hasKey || busy !== null} onClick={() => void getIdeas(false)}>
            {busy === 'ideas' ? 'Thinking up dinners… (up to a minute)' : 'Get dinner ideas'}
          </Button>
        </Card>
      ) : (
        <>
          <SectionTitle>1 · Pick dinners ({plan.selected.length} picked)</SectionTitle>
          <ul className="space-y-2">
            {plan.ideas.map((i) => {
              const on = plan.selected.includes(i.id)
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(i.id)}
                    className={`flex w-full gap-3 rounded-2xl border-2 p-3 text-left ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                  >
                    <span className={`mt-1 grid size-6 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}>{on && <Icon name="check" className="size-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{i.name}</span>
                      <span className="block text-sm text-muted">{i.description}</span>
                      <span className="num mt-1 block text-base">
                        {Math.round(i.calories)} kcal · {Math.round(i.proteinG)} g P · {i.satFatG} g SF · ~${i.estCostPerServingUsd.toFixed(2)}/serving · {Math.round(i.prepMinutes)} min
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <Badge>{i.cuisine}</Badge>
                        {i.leftoversForLunch && <Badge tone="good">Leftovers for lunch</Badge>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button disabled={busy !== null} onClick={() => void getIdeas(true)}>
              {busy === 'ideas' ? 'Thinking…' : 'More ideas'}
            </Button>
            <Button
              onClick={() => {
                if (window.confirm('Start over with new ideas? The current list will be cleared.')) save({ ...EMPTY, notes: plan.notes })
              }}
            >
              Start a new week
            </Button>
          </div>

          <SectionTitle>2 · Grocery list</SectionTitle>
          <Card className="space-y-2">
            <label htmlFor={notesId} className="text-sm font-medium">
              Anything to know? <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id={notesId}
              defaultValue={plan.notes}
              onBlur={(e) => save({ ...plan, notes: e.target.value })}
              rows={2}
              placeholder="e.g. we already have rice and chicken thighs, shopping at Aldi"
              className="w-full rounded-xl border border-line bg-surface-2 p-3"
            />
            <Button variant="primary" className="w-full" disabled={chosen.length === 0 || busy !== null} onClick={() => void makeList()}>
              {busy === 'list' ? 'Building the list… (up to a minute)' : plan.grocery ? `Rebuild list for ${chosen.length} dinner${chosen.length === 1 ? '' : 's'}` : `Make grocery list for ${chosen.length} dinner${chosen.length === 1 ? '' : 's'}`}
            </Button>
            {listIsStale && <p className="text-sm text-warn">You changed the picks since this list was made. Rebuild it to match.</p>}
          </Card>
        </>
      )}

      {err && (
        <p role="alert" className="mt-3 rounded-xl bg-bad/10 p-3 text-sm text-bad">
          {err}
        </p>
      )}

      {plan.grocery && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => void share('list')}>
              <span className="inline-flex items-center gap-2">
                <Icon name="share" className="size-5" /> Send list
              </span>
            </Button>
            <Button onClick={() => void share('recipes')}>
              <span className="inline-flex items-center gap-2">
                <Icon name="share" className="size-5" /> Send recipes
              </span>
            </Button>
          </div>
          {msg && <p className="mt-2 text-sm text-good">{msg}</p>}
          <Card className="mt-3">
            <p className="num text-2xl font-bold">About ${Math.round(plan.grocery.estTotalUsd)}</p>
            <p className="text-xs text-muted">Rough estimate at typical US prices. Tap items to check them off.</p>
            {plan.grocery.sections
              .filter((s) => s.items.length)
              .map((s) => (
                <div key={s.name} className="mt-3">
                  <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">{s.name}</p>
                  <ul>
                    {s.items.map((it) => {
                      const k = `${s.name}|${it.item}`
                      const done = plan.checked.includes(k)
                      return (
                        <li key={k}>
                          <button type="button" role="checkbox" aria-checked={done} onClick={() => toggleItem(k)} className="flex min-h-11 w-full items-center gap-3 text-left">
                            <span className={`grid size-5 shrink-0 place-items-center rounded border-2 ${done ? 'border-good bg-good text-bg' : 'border-line'}`}>{done && <Icon name="check" className="size-3.5" />}</span>
                            <span className={`min-w-0 flex-1 ${done ? 'text-muted line-through' : ''}`}>
                              {it.item} <span className="text-muted">· {it.quantity}</span>
                            </span>
                            <span className="num text-base text-muted">${it.estCostUsd.toFixed(2)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            {plan.grocery.pantryStaplesAssumed.length > 0 && <p className="mt-3 text-sm text-muted">Assumed already at home: {plan.grocery.pantryStaplesAssumed.join(', ')}.</p>}
            {plan.grocery.shoppingTips.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                {plan.grocery.shoppingTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </Card>

          <SectionTitle>Recipes</SectionTitle>
          <div className="space-y-2">
            {plan.grocery.recipes.map((rc) => (
              <details key={rc.name} className="rounded-2xl border border-line bg-surface p-3">
                <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                  {rc.name} <span className="font-normal text-muted">· serves {rc.servings}</span>
                </summary>
                <ul className="list-disc pl-5 text-sm">
                  {rc.ingredients.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {rc.steps.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
                {rc.tip && <p className="mt-2 text-sm text-muted">Tip: {rc.tip}</p>}
              </details>
            ))}
          </div>
        </>
      )}
    </Screen>
  )
}
