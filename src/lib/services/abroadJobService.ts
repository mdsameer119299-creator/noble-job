import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory } from "@/lib/supabase/useLocalInventory"
import { sortByStatus } from "@/lib/data/inventoryPagination"
import { filterRenderable, isValidJobId, renderableOrNull } from "@/lib/jobs/renderable"
import {
  getAbroadJobsPaginatedLocal,
  getAbroadJobByIdLocal,
  type AbroadJobFilters,
} from "@/lib/services/abroadJobLocal"
import { isSyntheticJobsVisible } from "@/lib/jobs/syntheticVisibility"
import type { AbroadJob } from "@/types/abroadJob"

export type { AbroadJobFilters } from "@/lib/services/abroadJobLocal"

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export async function getAbroadJobsPaginated(filters: AbroadJobFilters = {}) {
  return getAbroadJobsPaginatedLocal(filters, await isSyntheticJobsVisible())
}

export async function getAbroadJobs(filters: AbroadJobFilters = {}): Promise<AbroadJob[]> {
  const local = getAbroadJobsPaginatedLocal(filters, await isSyntheticJobsVisible()).items
  if (preferLocalInventory() || !isSupabaseConfigured()) return local

  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    let q = sb.from("abroad_jobs").select("*").eq("status", "active")
    if (filters.q) q = q.or(`title.ilike.%${filters.q}%,company.ilike.%${filters.q}%`)
    if (filters.country) q = q.ilike("country", `%${filters.country}%`)
    if (filters.category) q = q.eq("category", filters.category)
    q = q.order("posted_at", { ascending: false })
    const { data, error } = await q
    if (error || !data?.length) return local
    // Incomplete rows stay in the database but are never exposed.
    const remote = sortByStatus(filterRenderable(data as unknown as AbroadJob[], "abroad"))
    return remote.length ? remote : local
  } catch {
    return local
  }
}

export async function getAbroadJobById(id: string): Promise<AbroadJob | null> {
  if (!isValidJobId(id)) return null
  const local = renderableOrNull(getAbroadJobByIdLocal(id, await isSyntheticJobsVisible()), "abroad")
  if (preferLocalInventory() || !isSupabaseConfigured()) return local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    const { data } = await sb.from("abroad_jobs").select("*").eq("id", id).maybeSingle()
    // Exists but incomplete → not found (never an empty job page, never a local swap).
    if (data) return renderableOrNull(data as unknown as AbroadJob, "abroad")
    return local
  } catch {
    return local
  }
}
