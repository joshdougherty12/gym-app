// Secrets set with `wrangler secret`, which `wrangler types` can't see.
interface Env {
  /** JSON array of daily notes (love.ts). Unset: no notes for anyone. */
  LOVE_NOTES?: string
}
