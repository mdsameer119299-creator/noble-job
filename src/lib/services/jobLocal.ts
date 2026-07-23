/**
 * Local-only private job helpers (no Supabase imports).
 */
import { PRIVATE_INVENTORY } from "@/lib/data/jobInventory"
import { sortByStatus, countByStatus } from "@/lib/data/inventoryPagination"
import { applySyntheticVisibility } from "@/lib/jobs/syntheticVisibility"
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

export function getPrivateJobsLocal(filter: JobFilter = {}, syntheticVisible = true): JobSearchResult {
  const page = filter.page ?? 1
  const limit = filter.limit ?? 20
  const preStatus = filterPrivateJobs(applySyntheticVisibility(PRIVATE_INVENTORY, syntheticVisible), filter)
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

export function getPrivateJobByIdLocal(id: string, syntheticVisible = true): Job | null {
  const job = PRIVATE_INVENTORY.find(j => j.id === id) ?? null
  if (!job) return null
  return applySyntheticVisibility([job], syntheticVisible)[0] ?? null
}

export function getPrivateJobsFeaturedLocal(limit = 4, syntheticVisible = true): Job[] {
  return sortByStatus(applySyntheticVisibility([...PRIVATE_INVENTORY], syntheticVisible)).slice(0, limit)
}

export function getPrivateJobsCountLocal(syntheticVisible = true): number {
  return applySyntheticVisibility(PRIVATE_INVENTORY, syntheticVisible).filter(
    j => (j.jobStatus ?? "VERIFIED_JOB") !== "ARCHIVED_JOB",
  ).length
}
