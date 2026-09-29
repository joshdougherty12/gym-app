import { create } from 'zustand'
import type { ThemeId } from '../lib/accent'

/**
 * The look in use (a fixed accent or today's season) and whose phone this is,
 * set by App from settings, the partner link and the date, for components that
 * change with them.
 */
export const useAccentStore = create<{
  accent: ThemeId
  role: 'sophie' | 'joshua' | null
  set: (a: ThemeId) => void
  setRole: (r: 'sophie' | 'joshua' | null) => void
}>((set) => ({
  accent: 'orange',
  role: null,
  set: (accent) => set({ accent }),
  setRole: (role) => set({ role }),
}))
