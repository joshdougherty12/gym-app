import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

const KEY = 'cutline-settings-open'

function readOpen(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** One open section at a time; remembers the open one while the app is open. */
export function useAccordion(): { open: string | null; toggle: (id: string) => void } {
  const [open, setOpen] = useState<string | null>(readOpen)
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = cur === id ? null : id
      try {
        if (next) sessionStorage.setItem(KEY, next)
        else sessionStorage.removeItem(KEY)
      } catch {
        /* per-session convenience only */
      }
      return next
    })
  return { open, toggle }
}

/** A collapsible settings section: title and a one-line summary; tap to open. */
export function Section({ id, title, summary, open, onToggle, children }: { id: string; title: string; summary: ReactNode; open: boolean; onToggle: (id: string) => void; children: ReactNode }) {
  const bodyId = useId()
  return (
    <section className={`rounded-2xl border bg-surface ${open ? 'border-accent' : 'border-line'}`}>
      <h2>
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="num block text-xl leading-tight font-bold uppercase">{title}</span>
            <span className="block truncate text-sm text-muted">{summary}</span>
          </span>
          <Icon name="chevronRight" className={`size-5 shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="border-t border-line px-4 pt-3 pb-4">
          {children}
        </div>
      )}
    </section>
  )
}
