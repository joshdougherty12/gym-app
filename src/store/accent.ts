import { create } from 'zustand'
import type { AccentPref } from '../types'

/**
 * The accent in use and whose phone this is (set by App from settings and the
 * partner link), for components that change with them.
 */
export const useAccentStore = create<{
  accent: AccentPref
  role: 'sophie' | 'joshua' | null
  set: (a: AccentPref) => void
  setRole: (r: 'sophie' | 'joshua' | null) => void
}>((set) => ({
  accent: 'orange',
  role: null,
  set: (accent) => set({ accent }),
  setRole: (role) => set({ role }),
}))
