import { SYNC_URL } from './config'

/** How the engine reaches the server. Tests pass a fake. */
export interface SyncDeps {
  baseUrl: string
  fetch: (url: string, init: RequestInit) => Promise<Response>
}

export const defaultDeps: SyncDeps = {
  baseUrl: SYNC_URL,
  fetch: (url, init) => fetch(url, init),
}

/** The server answered with an error status. */
export class SyncHttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string) {
    super(`sync ${status} ${code}`)
    this.status = status
    this.code = code
  }
}

/** The server could not be reached (offline, DNS, CORS, timeout). */
export class SyncOfflineError extends Error {}

export interface Creds {
  householdId: string
  secret: string
  memberId?: string
}

export async function call<T>(deps: SyncDeps, creds: Creds, method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${creds.secret}` }
  if (creds.memberId) headers['X-Member'] = creds.memberId
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 20_000) : undefined
  try {
    res = await deps.fetch(`${deps.baseUrl}/v1/households/${creds.householdId}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(ctrl ? { signal: ctrl.signal } : {}),
    })
  } catch {
    throw new SyncOfflineError('offline')
  } finally {
    if (timer) clearTimeout(timer)
  }
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    /* empty or not JSON */
  }
  if (!res.ok) {
    const code = typeof json === 'object' && json !== null && typeof (json as { error?: unknown }).error === 'string' ? (json as { error: string }).error : 'error'
    throw new SyncHttpError(res.status, code)
  }
  return json as T
}

/** The household no longer exists or this phone was removed from it. */
export function isGone(e: unknown): boolean {
  return e instanceof SyncHttpError && (e.status === 410 || e.status === 404 || e.status === 401 || (e.status === 403 && e.code === 'not_a_member'))
}
