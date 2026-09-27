/** The partner sync server, from the build. Empty means the feature is hidden. */
export const SYNC_URL: string = (import.meta.env.VITE_SYNC_URL ?? '').trim().replace(/\/+$/, '')

export function partnerAvailable(): boolean {
  return SYNC_URL.length > 0
}
