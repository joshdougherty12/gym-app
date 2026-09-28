import { create } from 'zustand'
import type { AccentPref } from '../types'

/** The accent in use (set by App from settings and the partner link), for components that change shape with it. */
export const useAccentStore = create<{ accent: AccentPref; set: (a: AccentPref) => void }>((set) => ({
  accent: 'orange',
  set: (accent) => set({ accent }),
}))
