import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory } from "@/lib/supabase/useLocalInventory"
import { sortByStatus } from "@/lib/data/inventoryPagination"
import {
  getAbroadJobsPaginatedLocal,
  getAbroadJobByIdLocal,
  type AbroadJobFilters,
} from "@/lib/services/abroadJobLocal"
import type { AbroadJob } from "@/types/abroadJob"

export type { AbroadJobFilters } from "@/lib/services/abroadJobLocal"

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export function getAbroadJobsPaginated(filters: AbroadJobFilters = {}) {
  return getAbroadJobsPaginatedLocal(filters)
}

export async function getAbroadJobs(filters: AbroadJobFilters = {}): Promise<AbroadJob[]> {
  const local = getAbroadJobsPaginatedLocal(filters).items
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
    return sortByStatus(data as unknown as AbroadJob[])
  } catch {
    return local
  }
}

export async function getAbroadJobById(id: string): Promise<AbroadJob | null> {
  const local = getAbroadJobByIdLocal(id)
  if (preferLocalInventory() || !isSupabaseConfigured()) return local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    const { data } = await sb.from("abroad_jobs").select("*").eq("id", id).maybeSingle()
    return (data as unknown as AbroadJob) ?? local
  } catch {
    return local
  }
}
