import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { CutlineDB } from './db'
import { deleteRecipe, saveRecipe } from './recipes'

const dbs: CutlineDB[] = []
let n = 0
const fresh = () => {
  const d = new CutlineDB(`recipes-test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

describe('saved recipes', () => {
  it('saves, replaces a same-name recipe instead of duplicating it, and deletes', async () => {
    const d = fresh()
    await d.open()
    const draft = { name: 'Turkey chili', servings: 4, ingredients: ['turkey'], steps: ['Cook.'], calories: 520, proteinG: 42 }
    const first = await saveRecipe(draft, d)
    const again = await saveRecipe({ ...draft, name: ' turkey CHILI', calories: 500 }, d)
    expect(again.id).toBe(first.id)
    expect(await d.recipes.count()).toBe(1)
    expect((await d.recipes.get(first.id))?.calories).toBe(500)
    await deleteRecipe(first.id, d)
    expect(await d.recipes.count()).toBe(0)
  })
})
