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

export function rateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): { success: boolean; remaining: number; resetAt: number } {
  const now   = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}
