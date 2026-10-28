import { isSupabaseConfigured } from "@/lib/supabase/config"
import { isProductionEnvironment, preferLocalInventory, shouldFallbackToLocal } from "@/lib/supabase/useLocalInventory"
import { BLUE_COLLAR_CATEGORIES } from "@/lib/data/jobInventory"
import { renderablePrivateInventory } from "@/lib/data/renderableInventory"
import { sortByStatus, countByStatus } from "@/lib/data/inventoryPagination"
import { getPrivateJobsLocal, getPrivateJobByIdLocal } from "@/lib/services/jobLocal"
import { mapPrivateJobRow } from "@/lib/services/jobMapper"
import { getLivePrivateJobs, getLivePrivateJobById } from "@/lib/services/liveJobOpportunities"
import { filterRenderable, isValidJobId, renderableOrNull } from "@/lib/jobs/renderable"
import { isSyntheticJobsVisible, applySyntheticVisibility } from "@/lib/jobs/syntheticVisibility"
import type { Job, JobFilter, JobSearchResult } from "@/types/job"

/**
 * Upper bound on rows read per list request. The renderable filter runs in memory
 * so that `total`, `totalPages`, `counts` and the page rows all describe the SAME
 * set. Genuine inventory is expected to remain well below this cap.
 *
 * Exported so the sitemap snapshot reader can paginate in exactly this page size
 * and detect end-of-data (page returned < MAX_POOL_ROWS rows).
 */
export const MAX_POOL_ROWS = 1000

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export class QueryTimeoutError extends Error {
  constructor(ms: number) {
    super(`Supabase query exceeded ${ms}ms`)
    this.name = "QueryTimeoutError"
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new QueryTimeoutError(ms)), ms)
    Promise.resolve(promise).then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

function logQueryFallback(scope: string, err: unknown): void {
  if (err instanceof QueryTimeoutError) {
    console.warn(`[jobService:${scope}] live query timed out, serving fallback:`, err.message)
  } else {
    console.error(`[jobService:${scope}] live query failed, serving fallback:`, err)
  }
}

export async function getJobs(filter: JobFilter = {}): Promise<JobSearchResult> {
  const page = filter.page ?? 1
  const limit = filter.limit ?? 20
  const { q, category, location, exp, type: jType, sort = "latest" } = filter
  const syntheticVisible = await isSyntheticJobsVisible()
  const localResult = () => getPrivateJobsLocal(filter, syntheticVisible)

  // Candidate-facing production inventory is built from genuine database jobs plus
  // the current employer-direct external feed. Synthetic/reference rows never make
  // it into this combined candidate set when the production switch is OFF.
  const liveExternal = filter.status && filter.status !== "all" && filter.status !== "LIVE_JOB"
    ? []
    : await getLivePrivateJobs({ q, location, type: jType })

  if (preferLocalInventory() || !isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      const start = (page - 1) * limit
      return { jobs: liveExternal.slice(start, start + limit), total: liveExternal.length, page, totalPages: Math.ceil(liveExternal.length / limit), counts: countByStatus(liveExternal) }
    }
    if (liveExternal.length) {
      const local = localResult()
      const combined = [...liveExternal, ...local.jobs.filter(j => !liveExternal.some(x => x.id === j.id))]
      const start = (page - 1) * limit
      return {
        jobs: combined.slice(start, start + limit),
        total: combined.length,
        page,
        totalPages: Math.ceil(combined.length / limit),
        counts: countByStatus(combined),
      }
    }
    return localResult()
  }

  try {
    const sb = await getSupabaseClient()
    if (!sb) return isProductionEnvironment() ? { jobs: liveExternal, total: liveExternal.length, page, totalPages: Math.ceil(liveExternal.length / limit), counts: countByStatus(liveExternal) } : localResult()

    let query = sb.from("jobs").select("*").eq("status", "active")

    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    if (category === "blue-collar") query = query.in("category", [...BLUE_COLLAR_CATEGORIES])
    else if (category && category !== "all") query = query.eq("category", category)
    if (location && location !== "All Locations") query = query.ilike("location", `%${location}%`)
    if (exp) query = query.eq("experience_required", exp)
    if (jType) query = query.eq("job_type", jType)

    if (sort === "latest") query = query.order("posted_at", { ascending: false })
    else if (sort === "salary_high") query = query.order("salary_max", { ascending: false })

    if (filter.status && filter.status !== "all") query = query.eq("job_status", filter.status)

    const { data, error } = await withTimeout(query.range(0, MAX_POOL_ROWS - 1), 8000)
    if (error) {
      console.error("[jobService:getJobs] live query returned an error, using external/local fallback:", error.message)
      if (liveExternal.length) {
        const start = (page - 1) * limit
        return {
          jobs: liveExternal.slice(start, start + limit),
          total: liveExternal.length,
          page,
          totalPages: Math.ceil(liveExternal.length / limit),
          counts: countByStatus(liveExternal),
        }
      }
      return isProductionEnvironment()
        ? { jobs: [], total: 0, page, totalPages: 0, counts: { all: 0, live: 0, verified: 0, archived: 0 } }
        : localResult()
    }

    const pool = sortByStatus(
      applySyntheticVisibility(
        filterRenderable(data?.map(row => mapPrivateJobRow(row as Record<string, unknown>)) ?? [], "private"),
        syntheticVisible,
      ),
    )

    const combined = [...liveExternal, ...pool.filter(j => !liveExternal.some(x => x.id === j.id))]
    if (shouldFallbackToLocal(combined.length, renderablePrivateInventory().length) && !liveExternal.length) return localResult()

    const start = (page - 1) * limit
    return {
      jobs: combined.slice(start, start + limit),
      total: combined.length,
      page,
      totalPages: Math.ceil(combined.length / limit),
      counts: countByStatus(combined),
    }
  } catch (err) {
    logQueryFallback("getJobs", err)
    if (liveExternal.length) {
      const start = (page - 1) * limit
      return {
        jobs: liveExternal.slice(start, start + limit),
        total: liveExternal.length,
        page,
        totalPages: Math.ceil(liveExternal.length / limit),
        counts: countByStatus(liveExternal),
      }
    }
    return isProductionEnvironment() ? { jobs: [], total: 0, page, totalPages: 0, counts: { all: 0, live: 0, verified: 0, archived: 0 } } : localResult()
  }
}

/**
 * The result of one page fetch for the sitemap snapshot reader. Preserves the
 * raw Supabase row count so the paginator can detect end-of-data correctly —
 * `rawRowCount` reflects the number of rows the DB returned BEFORE in-memory
 * mapping/filtering, which is the only reliable signal that a page boundary has
 * been reached.
 */
export interface SnapshotPage {
  /** Mapped, filtered, renderable Job rows for this page. */
  jobs: Job[]
  /**
   * The number of raw rows returned by Supabase for this page request, i.e.
   * `data.length` BEFORE `filterRenderable` / `applySyntheticVisibility`.
   * Use this (not `jobs.length`) to detect end-of-data: when rawRowCount <
   * pageSize the DB has no more rows regardless of how many passed the filter.
   */
  rawRowCount: number
}

/**
 * Fetch one page of active private-board jobs for the sitemap snapshot reader.
 *
 * Unlike getJobs(), this function NEVER returns a fallback on failure — it throws
 * so the snapshot reader can detect a partial/failed read and let readOrThrow()
 * abort ISR regeneration, preserving the previously-served sitemap.
 *
 * Uses supabaseAdmin (service-role, cookie-less) instead of the cookie-based
 * server client so this function works during ISR background regeneration, where
 * cookies() is unavailable.  The snapshot is a server-side background operation
 * that never acts on behalf of a user session — it has no need for a cookie jar.
 * This follows the established pattern in readSitemapJobRows() (sitemapJobs.ts)
 * and loadActiveGovtRows() (govtStatsSource.ts).
 *
 * RLS note: supabaseAdmin bypasses Row Level Security.  The query selects only
 * status='active' rows and the result is run through filterRenderable(),
 * applySyntheticVisibility(), and — in the caller — isIndexable(), which together
 * ensure only eligible public job records reach the sitemap.
 *
 * Ordering: posted_at DESC, id ASC — the secondary sort on id eliminates
 * duplicate/skipped rows across page boundaries when multiple jobs share the
 * same posted_at timestamp.
 *
 * `syntheticVisible` is passed in from the caller rather than fetched here so
 * the admin_settings query runs exactly once per snapshot pass, not once per
 * page.  The caller (getGenuineOpenJobsSnapshot) resolves it before the loop.
 *
 * @param offset           Zero-based row offset (0, MAX_POOL_ROWS, 2×MAX_POOL_ROWS …)
 * @param pageSize         Rows to request — must be ≤ MAX_POOL_ROWS
 * @param syntheticVisible Whether synthetic jobs are currently visible (resolved once by caller)
 * @returns  SnapshotPage with both the filtered jobs and the raw Supabase row count.
 * @throws  QueryTimeoutError on timeout; Error on any Supabase/network error.
 */
export async function getPrivateJobsForSnapshot(
  offset: number,
  pageSize: number,
  syntheticVisible: boolean,
): Promise<SnapshotPage> {
  if (!isSupabaseConfigured()) {
    throw new Error("[jobService:snapshot] Supabase is not configured — cannot build sitemap snapshot")
  }
  // Use the service-role admin client — it does not require a cookie/request
  // context and therefore works during ISR background regeneration.
  const { supabaseAdmin } = await import("@/lib/supabase/admin")
  const sb = supabaseAdmin

  const query = sb
    .from("jobs")
    .select("*")
    .eq("status", "active")
    .order("posted_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + pageSize - 1)

  const { data, error } = await withTimeout(query, 8000)

  if (error) {
    throw new Error(`[jobService:snapshot] DB error on page offset=${offset}: ${error.message}`)
  }

  const rawRowCount = (data ?? []).length
  const jobs = applySyntheticVisibility(
    filterRenderable(
      (data ?? []).map(row => mapPrivateJobRow(row as Record<string, unknown>)),
      "private",
    ),
    syntheticVisible,
  )

  return { jobs, rawRowCount }
}

export async function getJobById(id: string): Promise<Job | null> {
  if (!isValidJobId(id)) return null
  const syntheticVisible = await isSyntheticJobsVisible()
  const local = renderableOrNull(getPrivateJobByIdLocal(id, syntheticVisible), "private")
  if (preferLocalInventory() || !isSupabaseConfigured()) {
    if (isProductionEnvironment()) return await getLivePrivateJobById(id)
    return (await getLivePrivateJobById(id)) || local
  }
  try {
    const sb = await getSupabaseClient()
    if (!sb) return isProductionEnvironment() ? await getLivePrivateJobById(id) : (await getLivePrivateJobById(id)) || local
    const { data, error } = await withTimeout(sb.from("jobs").select("*").eq("id", id).maybeSingle(), 8000)
    if (error) {
      console.error("[jobService:getJobById] live query returned an error:", error.message)
      return (await getLivePrivateJobById(id)) || local
    }
    if (data) {
      const mapped = renderableOrNull(
        applySyntheticVisibility([mapPrivateJobRow(data as Record<string, unknown>)], syntheticVisible)[0] ?? null,
        "private",
      )
      if (mapped) return mapped
    }
    return (await getLivePrivateJobById(id)) || local
  } catch (err) {
    logQueryFallback("getJobById", err)
    return isProductionEnvironment() ? await getLivePrivateJobById(id) : (await getLivePrivateJobById(id)) || local
  }
}
