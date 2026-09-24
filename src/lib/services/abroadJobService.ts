import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory } from "@/lib/supabase/useLocalInventory"
import { sortByStatus } from "@/lib/data/inventoryPagination"
import { filterRenderable, isValidJobId, renderableOrNull } from "@/lib/jobs/renderable"
import {
  getAbroadJobsPaginatedLocal,
  getAbroadJobByIdLocal,
  type AbroadJobFilters,
} from "@/lib/services/abroadJobLocal"
import { getLiveAbroadJobs, getLiveAbroadJobById } from "@/lib/services/liveJobOpportunities"
import { isSyntheticJobsVisible, applySyntheticVisibility } from "@/lib/jobs/syntheticVisibility"
import type { AbroadJob } from "@/types/abroadJob"

export type { AbroadJobFilters } from "@/lib/services/abroadJobLocal"

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export async function getAbroadJobsPaginated(filters: AbroadJobFilters = {}) {
  const all = await getAbroadJobs(filters)
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

export async function getAbroadJobs(filters: AbroadJobFilters = {}): Promise<AbroadJob[]> {
  const syntheticVisible = await isSyntheticJobsVisible()
  const local = getAbroadJobsPaginatedLocal(filters, syntheticVisible).items
  const liveExternal = await getLiveAbroadJobs({ q: filters.q, country: filters.country, category: filters.category })

  if (preferLocalInventory() || !isSupabaseConfigured()) {
    return [...liveExternal, ...local.filter(j => !liveExternal.some(x => x.id === j.id))]
  }

  try {
    const sb = await getSupabaseClient()
    if (!sb) return [...liveExternal, ...local]
    let q = sb.from("abroad_jobs").select("*").eq("status", "active")
    if (filters.q) q = q.or(`title.ilike.%${filters.q}%,company.ilike.%${filters.q}%`)
    if (filters.country) q = q.ilike("country", `%${filters.country}%`)
    if (filters.category) q = q.eq("category", filters.category)
    q = q.order("posted_at", { ascending: false })
    const { data, error } = await q
    if (error) return [...liveExternal, ...local]
    const dbJobs = sortByStatus(
      applySyntheticVisibility(filterRenderable((data || []) as unknown as AbroadJob[], "abroad"), syntheticVisible),
    )
    return [...liveExternal, ...dbJobs.filter(j => !liveExternal.some(x => x.id === j.id))]
  } catch {
    return [...liveExternal, ...local]
  }
}

export async function getAbroadJobById(id: string): Promise<AbroadJob | null> {
  if (!isValidJobId(id)) return null
  const syntheticVisible = await isSyntheticJobsVisible()
  const local = renderableOrNull(getAbroadJobByIdLocal(id, syntheticVisible), "abroad")
  if (preferLocalInventory() || !isSupabaseConfigured()) return (await getLiveAbroadJobById(id)) || local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return (await getLiveAbroadJobById(id)) || local
    const { data } = await sb.from("abroad_jobs").select("*").eq("id", id).maybeSingle()
    if (data) {
      const mapped = renderableOrNull(
        applySyntheticVisibility([data as unknown as AbroadJob], syntheticVisible)[0] ?? null,
        "abroad",
      )
      if (mapped) return mapped
    }
    return (await getLiveAbroadJobById(id)) || local
  } catch {
    return (await getLiveAbroadJobById(id)) || local
  }
}
