/**
 * govtCache.ts — cache configuration for the shared govt_jobs read.
 *
 * Kept in its own dependency-free module so the value is unit-testable without
 * importing the React Server Component-coupled data source (which pulls in
 * `react`/`next/cache` and cannot run in a plain node test harness).
 */

/**
 * TTL (seconds) for the cross-request `unstable_cache` around
 * `getActiveGovtRows()`. ~5 minutes: govt data changes at most hourly (ingestion
 * cron), so this is behaviour-neutral for users while collapsing the dominant
 * per-request full-table read into one read per window.
 */
export const GOVT_ROWS_CACHE_TTL_SECONDS = 300
