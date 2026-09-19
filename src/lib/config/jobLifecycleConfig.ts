/**
 * jobLifecycleConfig.ts — tunables for the job expiry / freshness lifecycle.
 * Dependency-free (env passed in) so it is unit-testable.
 */

function positiveNumber(v: string | undefined): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * How long an open job may go without an employer/source confirmation before
 * NobleJob's INTERNAL review comes due. This is a review cadence, NOT a job
 * deadline — it is never published as `validThrough` or shown to candidates.
 * Override: JOB_REVIEW_INTERVAL_DAYS (default 45).
 */
export function jobReviewIntervalDays(env: Record<string, string | undefined> = process.env): number {
  return positiveNumber(env.JOB_REVIEW_INTERVAL_DAYS) ?? 45
}

/**
 * Days AFTER review comes due that an unconfirmed job is closed automatically.
 * `undefined` (the default) means "never auto-close for silence" — a review that
 * comes due is only reported until an operator opts in with
 * JOB_AUTO_CLOSE_GRACE_DAYS. A real, passed `application_deadline` always closes
 * the job regardless of this setting.
 */
export function jobAutoCloseGraceDays(env: Record<string, string | undefined> = process.env): number | undefined {
  return positiveNumber(env.JOB_AUTO_CLOSE_GRACE_DAYS)
}
