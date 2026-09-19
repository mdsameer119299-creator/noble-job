/**
 * govtSeedPolicy.ts — when (if ever) the hand-written seed government jobs may
 * be served.
 *
 * The seed rows in `src/lib/data/govtSeed.ts` / `fallbackJobs.ts` are demo data.
 * They must never be presented as CURRENT OFFICIAL inventory in production, so a
 * Supabase failure must not silently swap them in. They are allowed only:
 *   - in local development / tests, where no database is configured, or
 *   - when an operator explicitly opts in with GOVT_ALLOW_SEED_FALLBACK=true
 *     (e.g. a CI build with no database, or an intentional demo deployment).
 *
 * Dependency-free so it is unit-testable.
 */

export function isGovtSeedFallbackAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if ((env.GOVT_ALLOW_SEED_FALLBACK ?? "").toLowerCase() === "true") return true
  return env.NODE_ENV !== "production"
}

/**
 * How long a last-known-good copy of the real dataset may be served after the
 * database becomes unreachable. Older than this → an honest "unavailable" state.
 * Override with GOVT_LKG_MAX_AGE_HOURS.
 */
export function govtLastKnownGoodMaxAgeMs(env: Record<string, string | undefined> = process.env): number {
  const h = Number(env.GOVT_LKG_MAX_AGE_HOURS)
  return (Number.isFinite(h) && h > 0 ? h : 24) * 3600_000
}
