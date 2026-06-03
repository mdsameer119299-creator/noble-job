/**
 * Pagination + status helpers — kept separate from jobInventory.ts so Turbopack
 * can resolve exports without parsing the full ~20k-job generated module.
 */
import { JOB_STATUS_PRIORITY } from "@/types/job"
import type { JobStatus } from "@/types/job"

export function sortByStatus<T extends { jobStatus?: JobStatus }>(jobs: T[]): T[] {
  return [...jobs].sort(
    (a, b) =>
      (JOB_STATUS_PRIORITY[a.jobStatus ?? "VERIFIED_JOB"]) -
      (JOB_STATUS_PRIORITY[b.jobStatus ?? "VERIFIED_JOB"]),
  )
}

export function countByStatus(jobs: { jobStatus?: JobStatus }[]) {
  let live = 0, verified = 0, archived = 0
  for (const j of jobs) {
    if (j.jobStatus === "LIVE_JOB") live++
    else if (j.jobStatus === "ARCHIVED_JOB") archived++
    else verified++
  }
  return { all: jobs.length, live, verified, archived }
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
  counts: { all: number; live: number; verified: number; archived: number }
}

export function paginate<T>(
  list: T[],
  page: number,
  limit: number,
  counts: ReturnType<typeof countByStatus>,
): PaginatedResult<T> {
  return {
    items: list.slice((page - 1) * limit, page * limit),
    total: list.length,
    page,
    totalPages: Math.ceil(list.length / limit) || 1,
    counts,
  }
}
