/**
 * Local-only abroad job helpers (no Supabase imports).
 */
import { ABROAD_INVENTORY } from "@/lib/data/jobInventory"
import { sortByStatus, countByStatus, paginate, type PaginatedResult } from "@/lib/data/inventoryPagination"
import type { JobStatus } from "@/types/job"
import type { AbroadJob } from "@/types/abroadJob"

export interface AbroadJobFilters {
  q?: string
  country?: string
  category?: string
  status?: JobStatus | "all"
  page?: number
  limit?: number
}

function filterAbroadWithCounts(jobs: AbroadJob[], filters: AbroadJobFilters) {
  const { q, country, category, status } = filters
  let pre = [...jobs]
  if (q) {
    const term = q.toLowerCase()
    pre = pre.filter(
      j => j.title.toLowerCase().includes(term) || j.company.toLowerCase().includes(term),
    )
  }
  if (country) pre = pre.filter(j => j.country.toLowerCase() === country.toLowerCase())
  if (category) pre = pre.filter(j => j.category === category)
  const counts = countByStatus(pre)
  let list =
    status && status !== "all"
      ? pre.filter(j => (j.jobStatus ?? "VERIFIED_JOB") === status)
      : pre
  list = sortByStatus(list)
  return { list, counts }
}

export function getAbroadJobsPaginatedLocal(filters: AbroadJobFilters = {}): PaginatedResult<AbroadJob> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const { list, counts } = filterAbroadWithCounts(ABROAD_INVENTORY, filters)
  return paginate(list, page, limit, counts)
}

export function getAbroadJobByIdLocal(id: string): AbroadJob | null {
  return ABROAD_INVENTORY.find(j => j.id === id) ?? null
}
