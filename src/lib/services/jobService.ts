import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory, shouldFallbackToLocal } from "@/lib/supabase/useLocalInventory"
import { BLUE_COLLAR_CATEGORIES } from "@/lib/data/jobInventory"
import { renderablePrivateInventory } from "@/lib/data/renderableInventory"
import { sortByStatus, countByStatus } from "@/lib/data/inventoryPagination"
import { getPrivateJobsLocal, getPrivateJobByIdLocal } from "@/lib/services/jobLocal"
import { mapPrivateJobRow } from "@/lib/services/jobMapper"
import { filterRenderable, isValidJobId, renderableOrNull } from "@/lib/jobs/renderable"
import { isSyntheticJobsVisible } from "@/lib/jobs/syntheticVisibility"
import type { Job, JobFilter, JobSearchResult } from "@/types/job"

/**
 * Upper bound on rows read per list request. The renderable filter runs in memory
 * so that `total`, `totalPages`, `counts` and the page rows all describe the SAME
 * set (an SQL `count` cannot know which rows the gate will drop). The genuine
 * inventory is far below this; hitting the cap is logged.
 */
const MAX_POOL_ROWS = 1000

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

/**
 * A stalled/slow network call to Supabase never rejects on its own, so a plain
 * `await` can hang the caller indefinitely — and for callers with no Suspense
 * boundary of their own (e.g. JobsBrowseIndex), that hang blocks the entire
 * page. Race every live query against a bound so it always settles.
 */
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

/**
 * The local-inventory fallback is a legitimate degraded mode (e.g. Supabase
 * genuinely has no matching rows), so it must never itself look like an
 * error. But a *forced* fallback — the live query timed out or threw — is a
 * signal worth keeping visible, or a real outage silently reads as "working
 * as intended" forever. Timeouts and other failures are logged distinctly so
 * a persistent flood of one or the other in production logs is diagnosable
 * (slow query / missing index vs. Supabase down / misconfigured).
 */
function logQueryFallback(scope: string, err: unknown): void {
  if (err instanceof QueryTimeoutError) {
    console.warn(`[jobService:${scope}] live query timed out, serving local fallback:`, err.message)
  } else {
    console.error(`[jobService:${scope}] live query failed, serving local fallback:`, err)
  }
}

export async function getJobs(filter: JobFilter = {}): Promise<JobSearchResult> {
  const page = filter.page ?? 1
  const limit = filter.limit ?? 20
  const { q, category, location, exp, type: jType, sort = "latest" } = filter
  const syntheticVisible = await isSyntheticJobsVisible()
  const localResult = () => getPrivateJobsLocal(filter, syntheticVisible)
  if (preferLocalInventory() || !isSupabaseConfigured()) {
    return localResult()
  }

  try {
    const sb = await getSupabaseClient()
    if (!sb) return localResult()

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
      console.error("[jobService:getJobs] live query returned an error, serving local fallback:", error.message)
      return localResult()
    }
    if (!data?.length) {
      return localResult()
    }
    if (data.length >= MAX_POOL_ROWS) {
      console.warn(`[jobService:getJobs] read ${MAX_POOL_ROWS} rows (the cap); later rows are not listed`)
    }
    // Map WITHOUT inventing values, drop every record that cannot be shown as a
    // job (incomplete / placeholder / unknown provenance) — the rows stay in the
    // database, they are just not exposed — then count and paginate the SAME set.
    const pool = sortByStatus(
      filterRenderable(data.map(row => mapPrivateJobRow(row as Record<string, unknown>)), "private"),
    )
    if (shouldFallbackToLocal(pool.length, renderablePrivateInventory().length)) return localResult()
    const start = (page - 1) * limit
    return {
      jobs: pool.slice(start, start + limit),
      total: pool.length,
      page,
      totalPages: Math.ceil(pool.length / limit),
      counts: countByStatus(pool),
    }
  } catch (err) {
    logQueryFallback("getJobs", err)
    return localResult()
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  // "undefined", "null", whitespace and path-like ids are not jobs (404), never a lookup.
  if (!isValidJobId(id)) return null
  const local = renderableOrNull(getPrivateJobByIdLocal(id, await isSyntheticJobsVisible()), "private")
  if (preferLocalInventory() || !isSupabaseConfigured()) return local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    const { data, error } = await withTimeout(sb.from("jobs").select("*").eq("id", id).maybeSingle(), 8000)
    if (error) {
      console.error("[jobService:getJobById] live query returned an error, serving local fallback:", error.message)
      return local
    }
    // A row that EXISTS but is incomplete is "not found" — never an empty job page,
    // and never silently swapped for a different (local) record.
    if (data) return renderableOrNull(mapPrivateJobRow(data as Record<string, unknown>), "private")
    return local
  } catch (err) {
    logQueryFallback("getJobById", err)
    return local
  }
}
