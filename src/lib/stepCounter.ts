import { registerPlugin } from '@capacitor/core'
import { isNative } from './native'

export type StepPermission = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'

export interface StepStatus {
  /** The phone has a hardware step counter. */
  available: boolean
  permission: StepPermission
  enabled: boolean
  /** Wall-clock ms of the last reading, 0 if none. */
  lastSampleAt: number
}

interface StepCounterPlugin {
  getStatus(): Promise<StepStatus>
  requestPermission(): Promise<StepStatus>
  openSettings(): Promise<void>
  enable(): Promise<StepStatus>
  disable(): Promise<StepStatus>
  sampleNow(): Promise<StepStatus>
  getDailySteps(o: { from: string; to: string }): Promise<{ days: { date: string; steps: number }[] }>
  getToday(): Promise<{ date: string; steps: number }>
}

// Implemented in android/app/src/main/java/com/joshdougherty/cutline/steps/StepCounterPlugin.java.
const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter')

const OFF: StepStatus = { available: false, permission: 'denied', enabled: false, lastSampleAt: 0 }

/** Step counting exists only in the Android app. */
export const stepCounterSupported = (): boolean => isNative()

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isNative()) return fallback
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export const getStepStatus = () => safe(() => StepCounter.getStatus(), OFF)
export const requestStepPermission = () => safe(() => StepCounter.requestPermission(), OFF)
export const openStepSettings = () => safe(() => StepCounter.openSettings(), undefined)
export const sampleStepsNow = () => safe(() => StepCounter.sampleNow(), OFF)
export const getDailySteps = (from: string, to: string) => safe(async () => (await StepCounter.getDailySteps({ from, to })).days, [])
export const getTodaySteps = () => safe(() => StepCounter.getToday(), null)

/** Turn counting on; throws with a readable message if it can't. */
export async function enableStepCounting(): Promise<StepStatus> {
  if (!isNative()) throw new Error('Step counting works in the Android app only.')
  return StepCounter.enable()
}

export async function disableStepCounting(): Promise<StepStatus> {
  return safe(() => StepCounter.disable(), OFF)
}
