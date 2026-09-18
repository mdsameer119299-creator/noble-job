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

/**
 * Rotate jobs within each status bucket on a deterministic multi-day window.
 * This keeps every job in the inventory and preserves LIVE/VERIFIED/ARCHIVED
 * priority, while making the visible order refresh every few days instead of
 * looking identical on every visit. It deliberately does NOT change posted_at,
 * datePosted, validThrough, URLs, or sitemap lastmod values.
 */
export function rotateJobOrder<T extends { jobStatus?: JobStatus; id?: string }>(
  jobs: T[],
  board: string,
  windowDays = 3,
): T[] {
  if (jobs.length < 2 || windowDays < 1) return [...jobs]

  const dayBucket = Math.floor(Date.now() / 86400000 / windowDays)
  const hash = (value: string) => {
    let h = 2166136261
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  const groups = new Map<string, T[]>()
  for (const job of jobs) {
    const key = job.jobStatus ?? "VERIFIED_JOB"
    const group = groups.get(key) || []
    group.push(job)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .sort((a, b) => (JOB_STATUS_PRIORITY[a[0] as JobStatus] ?? 99) - (JOB_STATUS_PRIORITY[b[0] as JobStatus] ?? 99))
    .flatMap(([status, group]) => {
      if (group.length < 2) return group
      const offset = hash(`${board}:${status}:${dayBucket}`) % group.length
      return [...group.slice(offset), ...group.slice(0, offset)]
    })
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
