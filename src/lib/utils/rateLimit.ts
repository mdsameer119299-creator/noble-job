/**
 * rateLimit.ts — Edge-compatible rate limiter
 *
 * Used in API routes to prevent abuse:
 *  - Login endpoint: max 5 attempts per minute
 *  - Contact form: max 3 submissions per minute
 *  - Job search: max 60 requests per minute
 *
 * Uses an in-memory Map (suitable for edge functions with short lifespan).
 * For production at scale: swap to Upstash Redis via @upstash/ratelimit.
 */

interface RateLimitEntry {
  count:   number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * The store lives for the life of the process (Hostinger runs ONE long-lived Node process), and keys
 * can be attacker-influenced (one per client IP), so it MUST be bounded:
 *  - expired entries are swept lazily (no timers) at most once per SWEEP_INTERVAL_MS, and whenever
 *    the store reaches MAX_KEYS;
 *  - if live entries still fill MAX_KEYS, the OLDEST-inserted key is evicted (Map iteration order).
 *    Eviction forgets that key's counter (it fails open for that one key); it is the price of a hard
 *    memory bound, and an attacker can only flush counters by sending MAX_KEYS distinct live keys.
 * Counting behaviour for any live key is unchanged.
 */
export const RATE_LIMIT_MAX_KEYS = 10_000
export const RATE_LIMIT_SWEEP_INTERVAL_MS = 60_000
let lastSweepAt = 0

function sweepExpired(now: number) {
  lastSweepAt = now
  for (const [k, e] of store) if (now > e.resetAt) store.delete(k)
}

function admitNewKey(key: string, entry: RateLimitEntry, now: number) {
  if (now - lastSweepAt >= RATE_LIMIT_SWEEP_INTERVAL_MS) sweepExpired(now)
  if (store.size >= RATE_LIMIT_MAX_KEYS) {
    sweepExpired(now)
    while (store.size >= RATE_LIMIT_MAX_KEYS) {
      const oldest = store.keys().next().value
      if (oldest === undefined) break
      store.delete(oldest)
    }
  }
  store.set(key, entry)
}

/** Test helpers (not used by application code). */
export function __rateLimitStoreSize(): number { return store.size }
export function __rateLimitReset(): void { store.clear(); lastSweepAt = 0 }

export function rateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): { success: boolean; remaining: number; resetAt: number } {
  const now   = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const fresh = { count: 1, resetAt: now + windowMs }
    if (entry) {
      // expired entry for this very key: replace in place and move it to the newest position
      store.delete(key)
      store.set(key, fresh)
    } else {
      admitNewKey(key, fresh, now)
    }
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}
