/**
 * sitemapReadGuard.ts — build-phase short-circuit for data-backed sitemap sections.
 *
 * WHY. `next build` runs `sitemap()` during the static-export phase. At that point no
 * Supabase connection is available, and even if one were, the ~1,000+ Supabase queries
 * needed to qualify city×category / tail-city / govt taxonomy sections would easily
 * exceed Vercel's 60 s export timeout, causing BUILD_UTILS_SPAWN_1.
 *
 * The old approach called `fn()` first and caught any thrown error, only skipping when
 * isBuildPhase() was true. That did NOT prevent the queries from running — it only
 * suppressed the error after the timeout. The correct approach is to return the fallback
 * IMMEDIATELY in build phase, before invoking the callback at all.
 *
 * At runtime (ISR regeneration after the first request), isBuildPhase() returns false
 * and `fn()` runs normally. If `fn()` throws at runtime, the error is re-thrown so
 * Next.js keeps the previously generated good sitemap instead of publishing a partial one.
 *
 * VERCEL BUILD PHASE DETECTION. `process.env.NEXT_PHASE` is set by Next.js itself:
 *   "phase-production-build"  — `next build` (static export)
 *   "phase-production-server" — `next start` / runtime
 *   undefined                 — Jest / tsx test runner, `next dev`
 *
 * The guard is deliberately conservative: it short-circuits only on the exact string
 * "phase-production-build", so `next dev` and the test runner always execute `fn()`.
 */

export const isBuildPhase = (): boolean =>
  process.env.NEXT_PHASE === "phase-production-build"

/**
 * Guard a data-backed read for use in `sitemap()`.
 *
 * Build phase  → returns `fallback` immediately, **without invoking `fn()`**.
 *               Logs a clear INFO line so the build output explains why the section is empty.
 *
 * Runtime      → awaits `fn()`. If `fn()` throws, re-throws so the ISR machinery keeps
 *               the previously generated good sitemap rather than caching a partial one.
 */
export async function readOrThrow<T>(
  fn: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  if (isBuildPhase()) {
    console.info(
      `[sitemap] build phase — skipping "${label}" (deferred to runtime ISR). ` +
      `Sitemap will be regenerated within revalidate seconds after first request.`,
    )
    return fallback
  }
  // Runtime: execute and propagate failures — never cache a partial sitemap.
  return fn()
}
