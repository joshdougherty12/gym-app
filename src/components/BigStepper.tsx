import { useId, useState } from 'react'
import { Icon } from './Icon'

/**
 * Vertical stepper for set rows: big + on top, the number (tap to type with
 * the numeric keypad), big − below. Three fit side by side on a phone.
 */
export function BigStepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  max = 2000,
  decimals = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step: number
  min?: number
  max?: number
  decimals?: boolean
}) {
  const id = useId()
  // While typing, show the raw text; otherwise always show the current value.
  const [editing, setEditing] = useState<string | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="flex min-w-0 flex-1 flex-col items-stretch rounded-2xl bg-surface-2">
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(clamp(value + step))} className="grid h-12 place-items-center text-muted active:text-accent">
        <Icon name="plus" className="size-6" />
      </button>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={editing ?? String(value)}
        onFocus={(e) => {
          setEditing(String(value))
          e.currentTarget.select()
        }}
        onChange={(e) => {
          setEditing(e.target.value)
          const v = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(clamp(v))
        }}
        onBlur={() => setEditing(null)}
        className="num w-full bg-transparent text-center text-4xl leading-tight font-bold outline-none"
      />
      <div className="text-center text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{label}</div>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(clamp(value - step))} className="grid h-12 place-items-center text-muted active:text-accent">
        <Icon name="minus" className="size-6" />
      </button>
    </div>
  )
}
