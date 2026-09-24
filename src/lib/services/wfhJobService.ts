import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory } from "@/lib/supabase/useLocalInventory"
import { sortByStatus } from "@/lib/data/inventoryPagination"
import { filterRenderable, isValidJobId, renderableOrNull } from "@/lib/jobs/renderable"
import {
  getWfhJobsPaginatedLocal,
  getWfhJobByIdLocal,
  type WfhJobFilters,
} from "@/lib/services/wfhJobLocal"
import { getLiveWfhJobs, getLiveWfhJobById } from "@/lib/services/liveJobOpportunities"
import { isSyntheticJobsVisible, applySyntheticVisibility } from "@/lib/jobs/syntheticVisibility"
import type { WfhJob } from "@/types/wfhJob"

export type { WfhJobFilters } from "@/lib/services/wfhJobLocal"

function matchesWfhExperience(jobExp: string, filterExp: string): boolean {
  const e = (jobExp || "").toLowerCase()
  switch (filterExp) {
    case "fresher": return e.includes("fresher")
    case "0-2": return /0-2|1-3|fresher/.test(e)
    case "2-5": return /2-5|3-6/.test(e)
    case "5+": return /5\+|5-8|5-/.test(e)
    default: return e.includes(filterExp.toLowerCase())
  }
}

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export async function getWfhJobsPaginated(filters: WfhJobFilters = {}) {
  const all = await getWfhJobs(filters)
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.max(1, filters.limit ?? 20)
  const start = (page - 1) * limit
  const items = all.slice(start, start + limit)
  const live = all.filter(j => j.jobStatus === "LIVE_JOB").length
  const verified = all.filter(j => j.jobStatus === "VERIFIED_JOB").length
  const archived = all.filter(j => j.jobStatus === "ARCHIVED_JOB").length
  return {
    items,
    total: all.length,
    page,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    counts: { all: all.length, live, verified, archived },
  }
}

export async function getWfhJobs(filters: WfhJobFilters = {}): Promise<WfhJob[]> {
  const syntheticVisible = await isSyntheticJobsVisible()
  const local = getWfhJobsPaginatedLocal(filters, syntheticVisible).items
  const liveExternal = await getLiveWfhJobs({ q: filters.q, type: filters.type })

  if (preferLocalInventory() || !isSupabaseConfigured()) {
    return [...liveExternal, ...local.filter(j => !liveExternal.some(x => x.id === j.id))]
  }

  try {
    const sb = await getSupabaseClient()
    if (!sb) return [...liveExternal, ...local]
    let q = sb.from("wfh_jobs").select("*").eq("status", "active")
    if (filters.q) q = q.or(`title.ilike.%${filters.q}%,company.ilike.%${filters.q}%,description.ilike.%${filters.q}%`)
    if (filters.cat && filters.cat !== "all") q = q.eq("cat", filters.cat)
    if (filters.sort === "latest") q = q.order("posted_at", { ascending: false })
    else if (filters.sort === "applicants") q = q.order("applicants", { ascending: false })
    const { data, error } = await q
    if (error) return [...liveExternal, ...local]

    let dbJobs = sortByStatus(
      applySyntheticVisibility(filterRenderable((data || []) as unknown as WfhJob[], "wfh"), syntheticVisible),
    )
    if (filters.exp && filters.exp !== "all") {
      dbJobs = dbJobs.filter(j => matchesWfhExperience(j.experience, filters.exp!))
    }
    return [...liveExternal, ...dbJobs.filter(j => !liveExternal.some(x => x.id === j.id))]
  } catch {
    return [...liveExternal, ...local]
  }
}

export async function getWfhJobById(id: string): Promise<WfhJob | null> {
  if (!isValidJobId(id)) return null
  const syntheticVisible = await isSyntheticJobsVisible()
  const local = renderableOrNull(getWfhJobByIdLocal(id, syntheticVisible), "wfh")
  if (preferLocalInventory() || !isSupabaseConfigured()) return (await getLiveWfhJobById(id)) || local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return (await getLiveWfhJobById(id)) || local
    const { data } = await sb.from("wfh_jobs").select("*").eq("id", id).maybeSingle()
    if (data) {
      const mapped = renderableOrNull(
        applySyntheticVisibility([data as unknown as WfhJob], syntheticVisible)[0] ?? null,
        "wfh",
      )
      if (mapped) return mapped
    }
    return (await getLiveWfhJobById(id)) || local
  } catch {
    return (await getLiveWfhJobById(id)) || local
  }
}
