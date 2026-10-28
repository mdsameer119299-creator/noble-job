/**
 * genuineJobs.ts — jobs for a generated location page, restricted to GENUINE,
 * currently-open rows (provenance gate). Location gates, the counts printed on
 * those pages and their job lists all come from this one function, so a page
 * never advertises N openings while listing demo rows.
 *
 * SITEMAP SNAPSHOT
 * ────────────────
 * The sitemap used to call getGenuineOpenJobs() once per city×category and once
 * per tail-city combination — up to 1,396 Supabase queries in a single ISR
 * regeneration pass. That would recreate the same 60 s timeout that caused
 * BUILD_UTILS_SPAWN_1 in the build phase.
 *
 * getGenuineOpenJobsSnapshot() loads all genuine open private-board jobs in one
 * bounded query. The sitemap then derives city/category eligibility in memory
 * from that shared pool, dropping the query count from ~1,396 to 1.
 *
 * The snapshot approach must replicate the SAME provenance gate that
 * getGenuineOpenJobs() applies — isIndexable() — so the sitemap cannot list a
 * URL whose page would 404. It also replicates the DB's location and category
 * filters (case-insensitive substring for location, exact string for category)
 * so eligibility decisions match what the live pages show.
 */
import { getJobs } from "@/lib/services/jobService"
import { isIndexable } from "@/lib/jobs/provenance"
import type { Job, JobFilter } from "@/types/job"

/**
 * Over-fetch, then keep only genuine open rows: a small `limit` applied BEFORE
 * filtering could drop real rows sitting behind synthetic/unclassified ones.
 */
export async function getGenuineOpenJobs(filter: JobFilter): Promise<Job[]> {
  const want = filter.limit ?? 20
  const r = await getJobs({ ...filter, limit: Math.max(want * 4, 60) })
  return r.jobs.filter(isIndexable).slice(0, want)
}

/**
 * The maximum number of genuine open private-board jobs the sitemap snapshot
 * fetches in one call. The sitemap only needs to know whether each city/category
 * combination clears a small threshold (CITY_CATEGORY_MIN_GENUINE_JOBS = 3 by
 * default) — it does NOT need every job in the country. Cap at 3,000 rows:
 *   • big enough to cover all real combinations that should qualify
 *   • small enough that one Supabase call stays well under 60 s
 *   • explicit so over-fetching is easy to spot and retune via env var
 *
 * Configurable: SITEMAP_SNAPSHOT_LIMIT env var.
 */
export const SITEMAP_SNAPSHOT_DEFAULT_LIMIT = 3000

function snapshotLimitFromEnv(): number {
  const n = Number(process.env.SITEMAP_SNAPSHOT_LIMIT)
  return Number.isInteger(n) && n > 0 ? n : SITEMAP_SNAPSHOT_DEFAULT_LIMIT
}

export interface GenuineOpenJobsSnapshot {
  /** All genuine open private-board jobs in the snapshot (up to the limit). */
  jobs: Job[]
  /**
   * True when the snapshot hit the cap — some tail combinations may have been
   * missed. The sitemap logs a warning but continues; the previously-served
   * sitemap is preferred over failing ISR entirely.
   */
  capped: boolean
  /** How many rows were fetched from the database before isIndexable filtering. */
  fetchedTotal: number
}

/**
 * Load a bounded snapshot of ALL genuine open private-board jobs in one DB call.
 * Used by the sitemap to avoid ~1,396 per-combination queries.
 *
 * IMPORTANT: this fetches private-board jobs only (board = "private"). WFH /
 * abroad board job detail URLs are independently guarded by readSitemapJobRows()
 * inside readOrThrow(), which returns empty [] during build phase. The city ×
 * category and tail-city hubs only surface private-board jobs on their pages, so
 * they only need the private snapshot.
 */
export async function getGenuineOpenJobsSnapshot(): Promise<GenuineOpenJobsSnapshot> {
  const limit = snapshotLimitFromEnv()
  // Over-fetch by 25 % to leave room for isIndexable filtering without hitting
  // the cap on genuine rows. The fetch is a single Supabase query regardless.
  const fetchLimit = Math.ceil(limit * 1.25)
  const r = await getJobs({ limit: fetchLimit, sort: "latest" })
  const genuine = r.jobs.filter(isIndexable)
  const capped = genuine.length >= limit
  return {
    jobs: genuine.slice(0, limit),
    capped,
    fetchedTotal: r.jobs.length,
  }
}

/**
 * In-memory location filter — replicates the DB's `ilike("location", "%query%")`.
 * Case-insensitive substring match, same as Supabase's ilike with % wildcards.
 */
export function matchesLocation(job: Job, locationQuery: string): boolean {
  return job.location.toLowerCase().includes(locationQuery.toLowerCase())
}

/**
 * In-memory category filter — replicates the DB's `eq("category", label)`.
 * Exact match on the job's `cat` field (which stores the category label string).
 */
export function matchesCategory(job: Job, categoryLabel: string): boolean {
  return job.cat === categoryLabel
}

/**
 * Filter the snapshot to jobs matching both a city location query and a category
 * label. Returns at most `limit` results (slice for the min-count gate).
 */
export function filterSnapshotForCityCategory(
  snapshot: GenuineOpenJobsSnapshot,
  locationQuery: string,
  categoryLabel: string,
  limit: number,
): Job[] {
  const out: Job[] = []
  for (const j of snapshot.jobs) {
    if (matchesLocation(j, locationQuery) && matchesCategory(j, categoryLabel)) {
      out.push(j)
      if (out.length >= limit) break
    }
  }
  return out
}

/**
 * Filter the snapshot to jobs matching a city location query (any category).
 * Returns at most `limit` results.
 */
export function filterSnapshotForCity(
  snapshot: GenuineOpenJobsSnapshot,
  locationQuery: string,
  limit: number,
): Job[] {
  const out: Job[] = []
  for (const j of snapshot.jobs) {
    if (matchesLocation(j, locationQuery)) {
      out.push(j)
      if (out.length >= limit) break
    }
  }
  return out
}
