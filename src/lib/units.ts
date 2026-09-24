import type { Units } from '../types'

export const LB_PER_KG = 2.2046226218
export const CM_PER_IN = 2.54

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG
}

/** Round to a step (e.g. 0.5 kg), avoiding float noise like 72.49999. */
export function roundTo(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(Math.round(value / step) * step * 1000) / 1000
}

/** Weight for display in the chosen unit. */
export function displayWeight(lb: number, units: Units): number {
  return units === 'metric' ? roundTo(lbToKg(lb), 0.5) : roundTo(lb, 0.5)
}

/** A weight typed in the chosen unit, converted to stored lb. */
export function inputWeightToLb(value: number, units: Units): number {
  return units === 'metric' ? kgToLb(value) : value
}

export function weightUnit(units: Units): 'lb' | 'kg' {
  return units === 'metric' ? 'kg' : 'lb'
}

export function displayLength(inches: number, units: Units): number {
  return units === 'metric' ? roundTo(inches * CM_PER_IN, 0.5) : roundTo(inches, 0.25)
}

export function inputLengthToIn(value: number, units: Units): number {
  return units === 'metric' ? value / CM_PER_IN : value
}

export function lengthUnit(units: Units): 'in' | 'cm' {
  return units === 'metric' ? 'cm' : 'in'
}

/** 225 -> "225", 72.5 -> "72.5", 31.25 -> "31.25" */
export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100)
}
