/**
 * indexThresholds.ts — the minimum amount of GENUINE content a generated
 * location page needs before it is served / listed in the sitemap.
 *
 * Two rules, in one place (they used to be hard-coded constants scattered across
 * the landing modules):
 *
 *  1. Only GENUINE, currently-open jobs count. Synthetic (demo), unclassified,
 *     archived and closed rows never count toward a threshold — otherwise the
 *     generated ~19k-row demo inventory would "qualify" every city/category and
 *     mass-produce thin pages that look like real hiring hubs.
 *  2. Every threshold is configurable per environment (no redeploy of code to
 *     retune), with the previous values as defaults.
 *
 * Dependency-free on purpose (unit-testable, importable from anywhere).
 */
import { isIndexable, type Classifiable } from "../jobs/provenance"

/** Read a positive integer from the environment, else the default. */
export function thresholdFromEnv(
  name: string,
  fallback: number,
  env: Record<string, string | undefined> = process.env,
): number {
  const n = Number(env[name])
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** Tail-city hub (/jobs-in/[city]) — genuine open jobs required. Env: SEO_MIN_GENUINE_JOBS_TAIL_CITY. */
export const TAIL_CITY_MIN_GENUINE_JOBS = thresholdFromEnv("SEO_MIN_GENUINE_JOBS_TAIL_CITY", 5)

/** City × category page — genuine open jobs required. Env: SEO_MIN_GENUINE_JOBS_CITY_CATEGORY. */
export const CITY_CATEGORY_MIN_GENUINE_JOBS = thresholdFromEnv("SEO_MIN_GENUINE_JOBS_CITY_CATEGORY", 3)

/**
 * Govt state page — state-SPECIFIC active recruitments required for the state
 * page to be indexable / in the sitemap. Below it the page still renders (the
 * national pool, labelled as such) but is noindex,follow. Env: SEO_MIN_JOBS_GOVT_STATE.
 *
 * Default 3: a state page listing a single recruitment is thin. There is no Search
 * Console evidence supporting a lower bar, so the conservative default applies; it
 * can be retuned per environment without a code change.
 */
export const GOVT_STATE_DEFAULT_MIN_JOBS = 3
export const GOVT_STATE_MIN_JOBS = thresholdFromEnv("SEO_MIN_JOBS_GOVT_STATE", GOVT_STATE_DEFAULT_MIN_JOBS)

/** Number of genuine, currently-open jobs in a list. Synthetic/unclassified/closed do NOT count. */
export function countGenuineOpen(jobs: readonly Classifiable[]): number {
  let n = 0
  for (const j of jobs) if (isIndexable(j)) n++
  return n
}

/** Does this list clear `min` counting ONLY genuine open jobs? */
export function meetsGenuineThreshold(jobs: readonly Classifiable[], min: number): boolean {
  return countGenuineOpen(jobs) >= min
}
