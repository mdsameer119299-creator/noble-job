import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory, shouldFallbackToLocal } from "@/lib/supabase/useLocalInventory"
import { WFH_INVENTORY } from "@/lib/data/jobInventory"
import { sortByStatus } from "@/lib/data/inventoryPagination"
import {
  getWfhJobsPaginatedLocal,
  getWfhJobByIdLocal,
  type WfhJobFilters,
} from "@/lib/services/wfhJobLocal"
import { isSyntheticJobsVisible } from "@/lib/jobs/syntheticVisibility"
import type { WfhJob } from "@/types/wfhJob"

export type { WfhJobFilters } from "@/lib/services/wfhJobLocal"

function matchesWfhExperience(jobExp: string, filterExp: string): boolean {
  const e = jobExp.toLowerCase()
  switch (filterExp) {
    case "fresher":
      return e.includes("fresher")
    case "0-2":
      return /0-2|1-3|fresher/.test(e)
    case "2-5":
      return /2-5|3-6/.test(e)
    case "5+":
      return /5\+|5-8|5-/.test(e)
    default:
      return e.includes(filterExp.toLowerCase())
  }
}

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export async function getWfhJobsPaginated(filters: WfhJobFilters = {}) {
  return getWfhJobsPaginatedLocal(filters, await isSyntheticJobsVisible())
}

export async function getWfhJobs(filters: WfhJobFilters = {}): Promise<WfhJob[]> {
  const local = getWfhJobsPaginatedLocal(filters, await isSyntheticJobsVisible()).items
  if (preferLocalInventory() || !isSupabaseConfigured()) return local

  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    let q = sb.from("wfh_jobs").select("*").eq("status", "active")
    if (filters.q) {
      q = q.or(`title.ilike.%${filters.q}%,company.ilike.%${filters.q}%,description.ilike.%${filters.q}%`)
    }
    if (filters.cat && filters.cat !== "all") q = q.eq("cat", filters.cat)
    if (filters.sort === "latest") q = q.order("posted_at", { ascending: false })
    else if (filters.sort === "applicants") q = q.order("applicants", { ascending: false })
    const { data, error } = await q
    if (error || !data?.length) return local
    let remote = sortByStatus(data as unknown as WfhJob[])
    if (filters.exp && filters.exp !== "all") {
      remote = remote.filter(j => matchesWfhExperience(j.experience, filters.exp!))
    }
    return shouldFallbackToLocal(remote.length, WFH_INVENTORY.length) ? local : remote
  } catch {
    return local
  }
}

export async function getWfhJobById(id: string): Promise<WfhJob | null> {
  const local = getWfhJobByIdLocal(id, await isSyntheticJobsVisible())
  if (preferLocalInventory() || !isSupabaseConfigured()) return local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    const { data } = await sb.from("wfh_jobs").select("*").eq("id", id).maybeSingle()
    return (data as unknown as WfhJob) ?? local
  } catch {
    return local
  }
}
