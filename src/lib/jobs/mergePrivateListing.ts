/**
 * mergePrivateListing.ts — the ONE place the Private board's first-page listing is assembled.
 *
 * The Private board shows two sources side by side: the employer `jobs` table
 * (`getJobs()` / `GET /api/jobs`) and the live third-party Himalayas cache
 * (`getHimalayasJobsForDisplay()` / `GET /api/jobs/live`). Until now only the browser did the
 * merge, so the server-rendered HTML — what a crawler receives — contained NO jobs at all
 * while the employer table is empty, even though visitors see real listings once JS runs.
 *
 * Both the server page (initial HTML) and the client list (filter / pagination refetches) now
 * call this function, so what is server-rendered is, by construction, exactly what the client
 * would have produced for the same view.
 *
 * Pure and dependency-light on purpose: no server-only or Next imports, so it is unit-testable.
 */
import { toListingJobs, toLiveExternalJobs } from '@/lib/jobs/clientRecords'
import type { Job } from '@/types/job'

export type ListingCounts = { all: number; live: number; verified: number; archived: number }

export interface MergedPrivateListing {
  jobs: Job[]
  total: number
  totalPages: number
  counts: ListingCounts
}

/** Shape of `getJobs()` / the `/api/jobs` JSON body — only the fields the merge reads. */
export interface PrivateDbPage {
  jobs?: unknown
  total?: unknown
  totalPages?: unknown
  counts?: ListingCounts | null
}

/**
 * How many live third-party jobs the Private list shows for these cache rows — the very same
 * renderable / de-duplicated set `mergePrivateListing` puts on the page (live ids are unique within it).
 */
export function countLiveListing(liveRows: unknown): number {
  return new Set(toLiveExternalJobs(liveRows, 'LIVE_JOB').map(j => j.id)).size
}

/**
 * The Private board's status counts as its UNFILTERED first page presents them: the employer-table
 * counts plus the live third-party jobs the list merges in (they are "Live Jobs" in its tabs).
 * Hero / strip counters use this so "Roles to Explore" equals the number of jobs the list shows,
 * instead of silently excluding the live feed the list renders. Pure; no I/O.
 */
export function withLiveListingCounts(dbCounts: ListingCounts | null | undefined, liveRows: unknown): ListingCounts {
  const c = dbCounts || { all: 0, live: 0, verified: 0, archived: 0 }
  const n = countLiveListing(liveRows)
  return { all: c.all + n, live: c.live + n, verified: c.verified, archived: c.archived }
}

export function mergePrivateListing(dbData: PrivateDbPage, liveRows: unknown): MergedPrivateListing {
  // Every record is re-checked here: anything incomplete (no title / company /
  // description / location, unknown provenance) is dropped, nothing is defaulted.
  const rawDb: unknown[] = Array.isArray(dbData.jobs) ? dbData.jobs : []
  const dbJobs = toListingJobs(rawDb, 'VERIFIED_JOB')
  const liveJobs = toLiveExternalJobs(liveRows, 'LIVE_JOB')

  const seen = new Set<string>()
  const combined = [...liveJobs, ...dbJobs].filter(j => {
    if (seen.has(j.id)) return false
    seen.add(j.id)
    return true
  })
  const liveIds = new Set(liveJobs.map(j => j.id))
  const liveShown = combined.filter(j => liveIds.has(j.id)).length

  // The server's totals already describe renderable rows only; subtract anything
  // this check dropped so the count still equals what can be displayed.
  const dropped = rawDb.length - dbJobs.length
  const c: ListingCounts = dbData.counts || { all: 0, live: 0, verified: 0, archived: 0 }

  return {
    jobs: combined,
    total: Math.max(0, (Number(dbData.total) || dbJobs.length) - dropped) + liveShown,
    totalPages: Number(dbData.totalPages) || 1,
    counts: {
      all: Math.max(0, c.all - dropped) + liveShown,
      live: c.live + liveShown,
      verified: c.verified,
      archived: c.archived,
    },
  }
}
