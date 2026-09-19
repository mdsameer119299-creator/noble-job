import { getJobs } from "@/lib/services/jobService"
import { BLUE_COLLAR_CATEGORIES } from "@/lib/data/jobInventory"
import { isActiveStatus } from "@/lib/config/jobStrategy"
import { filterActionable } from "@/lib/jobs/renderable"
import type { Job } from "@/types/job"

const BLUE_COLLAR_SET = new Set<string>(BLUE_COLLAR_CATEGORIES)

/**
 * Blue-collar jobs (Driver, Delivery Boy, Security Guard, ...) pulled from the
 * same catalog as everything else on Private Jobs — respects the synthetic-
 * visibility admin toggle via getJobs(), same as every other public surface —
 * and, because the homepage teaser advertises them as "hiring across India", only
 * ACTIONABLE jobs (complete, genuine, open, real application route) are returned:
 * sample rows are never shown here as if they were openings.
 */
export async function getBlueCollarJobs(limit = 8): Promise<Job[]> {
  // Blue-collar rows are appended after the regular (white-collar) pool in
  // jobInventory.ts, so within their own LIVE/VERIFIED status tier they sort
  // AFTER ~1500 white-collar rows — the fetch limit must clear that, not just
  // the display count, or this always returns empty.
  const result = await getJobs({ limit: 2000, sort: "latest" })
  return filterActionable(
    result.jobs.filter(j => BLUE_COLLAR_SET.has(j.cat) && isActiveStatus(j.jobStatus)),
    "private",
  ).slice(0, limit)
}
