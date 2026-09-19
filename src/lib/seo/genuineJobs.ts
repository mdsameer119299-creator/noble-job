/**
 * genuineJobs.ts — jobs for a generated location page, restricted to GENUINE,
 * currently-open rows (provenance gate). Location gates, the counts printed on
 * those pages and their job lists all come from this one function, so a page
 * never advertises N openings while listing demo rows.
 */
import { getJobs } from "@/lib/services/jobService"
import { isIndexable } from "@/lib/jobs/provenance"
import type { Job, JobFilter } from "@/types/job"

/**
 * Over-fetch, then keep only genuine open rows: a small `limit` applied BEFORE
 * filtering could drop real rows sitting behind synthetic/unclassified ones.
 */
export async function getGenuineOpenJobs(filter: JobFilter): Promise<Job[]> {
  const want = filter.limit ?? 20
  const r = await getJobs({ ...filter, limit: Math.max(want * 4, 60) })
  return r.jobs.filter(isIndexable).slice(0, want)
}
