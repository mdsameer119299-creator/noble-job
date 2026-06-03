/**
 * Local-only private job helpers (no Supabase imports).
 */
import { PRIVATE_INVENTORY } from "@/lib/data/jobInventory"
import { sortByStatus, countByStatus } from "@/lib/data/inventoryPagination"
import type { Job, JobFilter, JobSearchResult } from "@/types/job"

function filterPrivateJobs(jobs: Job[], filter: JobFilter): Job[] {
  const { q, category, location, exp, type: jType } = filter
  let list = [...jobs]
  if (q) {
    const term = q.toLowerCase()
    list = list.filter(
      j =>
        j.title.toLowerCase().includes(term) ||
        j.company.toLowerCase().includes(term) ||
        (j.desc || "").toLowerCase().includes(term),
    )
  }
  if (category && category !== "all") list = list.filter(j => j.cat === category)
  if (location && location !== "All Locations") {
    list = list.filter(j => j.location.toLowerCase().includes(location.toLowerCase()))
  }
  if (exp) list = list.filter(j => (j.exp || "").toLowerCase().includes(exp.toLowerCase()))
  if (jType) list = list.filter(j => j.type === jType)
  return list
}

export function getPrivateJobsLocal(filter: JobFilter = {}): JobSearchResult {
  const page = filter.page ?? 1
  const limit = filter.limit ?? 20
  const preStatus = filterPrivateJobs(PRIVATE_INVENTORY, filter)
  const counts = countByStatus(preStatus)
  const status = filter.status
  let list =
    status && status !== "all"
      ? preStatus.filter(j => (j.jobStatus ?? "VERIFIED_JOB") === status)
      : preStatus
  list = sortByStatus(list)
  return {
    jobs: list.slice((page - 1) * limit, page * limit),
    total: list.length,
    page,
    totalPages: Math.ceil(list.length / limit) || 0,
    counts,
  }
}

export function getPrivateJobByIdLocal(id: string): Job | null {
  return PRIVATE_INVENTORY.find(j => j.id === id) ?? null
}

export function getPrivateJobsFeaturedLocal(limit = 4): Job[] {
  return sortByStatus([...PRIVATE_INVENTORY]).slice(0, limit)
}

export function getPrivateJobsCountLocal(): number {
  return PRIVATE_INVENTORY.filter(j => (j.jobStatus ?? "VERIFIED_JOB") !== "ARCHIVED_JOB").length
}
