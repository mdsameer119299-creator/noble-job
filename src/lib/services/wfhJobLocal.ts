/**
 * Local-only WFH job helpers (no Supabase imports).
 */
import { WFH_INVENTORY } from "@/lib/data/jobInventory"
import { sortByStatus, countByStatus, paginate, type PaginatedResult } from "@/lib/data/inventoryPagination"
import { applySyntheticVisibility } from "@/lib/jobs/syntheticVisibility"
import type { JobStatus } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"

export interface WfhJobFilters {
  q?: string
  cat?: string
  exp?: string
  sort?: string
  status?: JobStatus | "all"
  page?: number
  limit?: number
}

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

function filterWfhWithCounts(jobs: WfhJob[], filters: WfhJobFilters) {
  const { q, cat, exp, status } = filters
  let pre = [...jobs]
  if (q) {
    const term = q.toLowerCase()
    pre = pre.filter(
      j =>
        j.title.toLowerCase().includes(term) ||
        j.company.toLowerCase().includes(term) ||
        j.description.toLowerCase().includes(term),
    )
  }
  if (cat && cat !== "all") pre = pre.filter(j => j.cat === cat)
  if (exp && exp !== "all") pre = pre.filter(j => matchesWfhExperience(j.experience, exp))
  const counts = countByStatus(pre)
  let list =
    status && status !== "all"
      ? pre.filter(j => (j.jobStatus ?? "VERIFIED_JOB") === status)
      : pre
  list = sortByStatus(list)
  return { list, counts }
}

export function getWfhJobsPaginatedLocal(filters: WfhJobFilters = {}, syntheticVisible = true): PaginatedResult<WfhJob> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const { list, counts } = filterWfhWithCounts(applySyntheticVisibility(WFH_INVENTORY, syntheticVisible), filters)
  return paginate(list, page, limit, counts)
}

export function getWfhJobByIdLocal(id: string, syntheticVisible = true): WfhJob | null {
  const job = WFH_INVENTORY.find(j => j.id === id) ?? null
  if (!job) return null
  return applySyntheticVisibility([job], syntheticVisible)[0] ?? null
}
