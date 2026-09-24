import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory, shouldFallbackToLocal } from "@/lib/supabase/useLocalInventory"
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
 */
const MAX_POOL_ROWS = 1000

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
      return localResult()
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
    return localResult()
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  if (!isValidJobId(id)) return null
  const syntheticVisible = await isSyntheticJobsVisible()
  const local = renderableOrNull(getPrivateJobByIdLocal(id, syntheticVisible), "private")
  if (preferLocalInventory() || !isSupabaseConfigured()) return (await getLivePrivateJobById(id)) || local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return (await getLivePrivateJobById(id)) || local
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
    return (await getLivePrivateJobById(id)) || local
  }
}
