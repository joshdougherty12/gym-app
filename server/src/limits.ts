// Every limit the sync server enforces, in one place.

/** Largest request body accepted, in bytes. */
export const MAX_BODY_BYTES = 512 * 1024
/** Largest single encrypted record (base64url characters). */
export const MAX_RECORD_CHARS = 64 * 1024
/** Records accepted in one push. */
export const MAX_RECORDS_PER_PUSH = 200
/** Records one household may hold (tombstones included). */
export const MAX_RECORDS_PER_HOUSEHOLD = 5000
/** Total encrypted bytes one household may hold. */
export const MAX_BYTES_PER_HOUSEHOLD = 20 * 1024 * 1024
/** Couples only. */
export const MAX_MEMBERS = 2
/** Records returned by one pull, default and maximum. */
export const PULL_DEFAULT = 200
export const PULL_MAX = 500
/** Deleted-record markers older than this are purged; clients behind the purge resync from scratch. */
export const TOMBSTONE_TTL_MS = 30 * 24 * 3600 * 1000

/** Per-household request budget: a bucket of 120 that refills at 2 per second. */
export const RATE_CAPACITY = 120
export const RATE_REFILL_PER_SEC = 2
/** Household registrations per client IP per minute (best effort, per isolate). */
export const REGISTER_PER_MINUTE = 10

// Identifiers are random bytes in base64url: 16 bytes -> 22 chars, 32 bytes -> 43 chars.
export const ID_RE = /^[A-Za-z0-9_-]{22}$/
export const SECRET_RE = /^[A-Za-z0-9_-]{43}$/
export const DATA_RE = /^[A-Za-z0-9_-]+$/
