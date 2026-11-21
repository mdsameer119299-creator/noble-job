import { timingSafeEqual } from "node:crypto"

/**
 * Shared authorisation for /api/cron/* routes (previously copy-pasted in three routes).
 *  - Missing CRON_SECRET: FAIL CLOSED in production (never leave ingestion publicly callable); allowed elsewhere for local dev.
 *  - Otherwise the Authorization header must be exactly `Bearer <CRON_SECRET>`, compared in constant time.
 *  - Bearer header only (query-string secrets leak into logs/referrers).
 */
export function isCronAuthorized(
  authorizationHeader: string | null | undefined,
  secret: string | undefined = process.env.CRON_SECRET,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (!secret) return nodeEnv !== "production"
  const given = Buffer.from(authorizationHeader || "")
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}
