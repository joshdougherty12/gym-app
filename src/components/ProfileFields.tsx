import { useId, type ReactNode } from 'react'
import { Icon } from './Icon'

/** Big single-choice buttons, two per row (radio group). */
export function Choice<T extends string | number>({ label, value, options, onChange, cols = 2 }: { label: string; value: T | undefined; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; cols?: 1 | 2 | 3 }) {
  const grid = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div role="radiogroup" aria-label={label} className={`grid gap-2 ${grid}`}>
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`min-h-14 rounded-2xl border-2 px-3 py-2 text-left ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
            >
              <span className="block font-semibold">{o.label}</span>
              {o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Multi-select chips. */
export function Chips<T extends string>({ label, values, options, onChange, hint }: { label: string; values: T[]; options: { value: T; label: string }[]; onChange: (v: T[]) => void; hint?: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = values.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onChange(on ? values.filter((x) => x !== o.value) : [...values, o.value])}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted'}`}
            >
              {on && <Icon name="check" className="size-4" />}
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Large numeric input with a unit label. */
export function NumberField({ label, value, onChange, unit, min, max, step = 1 }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; unit?: string; min?: number; max?: number; step?: number }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <div className="flex items-baseline gap-2 rounded-2xl border-2 border-line bg-surface px-4 focus-within:border-accent">
        <input
          id={id}
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          value={value === undefined ? '' : String(value)}
          onChange={(e) => {
            const t = e.target.value.trim()
            if (t === '') return onChange(undefined)
            const n = Number(t)
            if (Number.isFinite(n)) onChange(n)
          }}
          onBlur={() => {
            if (value === undefined) return
            if (min !== undefined && value < min) onChange(min)
            if (max !== undefined && value > max) onChange(max)
          }}
          className="num min-h-14 w-full min-w-0 bg-transparent text-3xl font-bold outline-none"
        />
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
    </div>
  )
}

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="flex-1 text-sm font-medium">
        {label}
      </label>
      <input id={id} type="time" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3" />
    </div>
  )
}
