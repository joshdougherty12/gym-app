import type { PhaseId } from '../types'

// Literal class names so Tailwind can see them.
export const PHASE_BG: Record<PhaseId, string> = {
  intro: 'bg-phase-intro',
  base: 'bg-phase-base',
  push: 'bg-phase-push',
  deload: 'bg-phase-deload',
  peak: 'bg-phase-peak',
  extension: 'bg-phase-push',
}

export const PHASE_TEXT: Record<PhaseId, string> = {
  intro: 'text-phase-intro',
  base: 'text-phase-base',
  push: 'text-phase-push',
  deload: 'text-phase-deload',
  peak: 'text-phase-peak',
  extension: 'text-phase-push',
}
