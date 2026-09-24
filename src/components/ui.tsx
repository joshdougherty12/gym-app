import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from './Icon'

export function Screen({
  title,
  subtitle,
  back,
  action,
  children,
}: {
  title: string
  subtitle?: ReactNode
  back?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
      <header className="mb-4 flex items-end gap-2">
        {back && (
          <Link to={back} aria-label="Back" className="-ml-2 grid size-11 place-items-center rounded-full text-muted">
            <Icon name="chevronLeft" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="num text-4xl leading-none font-bold tracking-tight uppercase">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</section>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 mb-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">{children}</h2>
}

export function Loading() {
  return (
    <div className="grid min-h-[50dvh] place-items-center text-muted" role="status">
      Loading…
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
  className = '',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  type?: 'button' | 'submit'
  className?: string
  disabled?: boolean
}) {
  const styles = {
    primary: 'bg-accent text-accent-ink',
    secondary: 'bg-surface-2 text-ink',
    danger: 'bg-bad/15 text-bad',
    ghost: 'text-accent',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-xl px-4 font-semibold disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

/** Bottom sheet built on <dialog>, so focus trapping and Escape come for free. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-t border-line bg-surface p-0 text-ink sm:mx-auto sm:max-w-xl"
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <h2 id={titleId} className="num min-w-0 flex-1 truncate text-2xl font-bold uppercase">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-full text-muted">
              <Icon name="close" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      )}
    </dialog>
  )
}

/** Big +/- stepper with a typed value in the middle. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  const id = useId()
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000))
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="min-w-0 flex-1 text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center rounded-xl bg-surface-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="grid size-11 place-items-center text-muted"
        >
          <Icon name="minus" className="size-5" />
        </button>
        <input
          id={id}
          inputMode="decimal"
          value={Number.isFinite(value) ? String(value) : ''}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (e.target.value !== '' && Number.isFinite(v)) onChange(clamp(v))
          }}
          className="num w-16 bg-transparent text-center text-2xl font-semibold outline-none"
        />
        {suffix && <span className="-ml-2 pr-1 text-xs text-muted">{suffix}</span>}
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="grid size-11 place-items-center text-muted"
        >
          <Icon name="plus" className="size-5" />
        </button>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${
            value === o.value ? 'bg-accent text-accent-ink' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center gap-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line'}`}>
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  )
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'good' | 'warn' | 'bad' }) {
  const styles = {
    muted: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    good: 'bg-good/15 text-good',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
  }[tone]
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${styles}`}>{children}</span>
}
