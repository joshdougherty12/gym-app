import { create } from 'zustand'

const KEY = 'cutline-howto-open'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

interface HowToState {
  /** Exercise how-to descriptions shown (true) or collapsed (false, the default). Applies to every exercise. */
  open: boolean
  toggle: () => void
}

export const useHowTo = create<HowToState>((set, get) => ({
  open: read(),
  toggle: () => {
    const open = !get().open
    try {
      if (open) localStorage.setItem(KEY, '1')
      else localStorage.removeItem(KEY)
    } catch {
      /* a per-device convenience: still toggles for this visit */
    }
    set({ open })
  },
}))
