import { portionLine } from '../../lib/partner/portions'
import { usePortions } from '../../partner/hooks'

/** "Suggested portions: Josh 1.2 servings · Sam 0.8 servings", when linked and both targets are known. */
export function PortionLine() {
  const p = usePortions()
  if (!p) return null
  return (
    <p className="mt-2 rounded-xl bg-surface-2 p-2 text-sm">
      <span className="font-semibold">Suggested portions:</span> {portionLine(p.myName, p.theirName, p.split)}
      <span className="block text-xs text-muted">
        A suggestion: two servings split by your calorie targets ({p.myTarget.toLocaleString()} and {p.theirTarget.toLocaleString()} kcal).
      </span>
    </p>
  )
}
