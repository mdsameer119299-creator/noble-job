import { getJobs } from "@/lib/services/jobService"
import { BLUE_COLLAR_CATEGORIES } from "@/lib/data/jobInventory"
import { isActiveStatus } from "@/lib/config/jobStrategy"
import type { Job } from "@/types/job"

const BLUE_COLLAR_SET = new Set<string>(BLUE_COLLAR_CATEGORIES)

/**
 * Blue-collar jobs (Driver, Delivery Boy, Security Guard, ...) pulled from the
 * same catalog as everything else on Private Jobs — respects the synthetic-
 * visibility admin toggle via getJobs(), same as every other public surface.
 */
export async function getBlueCollarJobs(limit = 8): Promise<Job[]> {
  const result = await getJobs({ limit: 300, sort: "latest" })
  return result.jobs.filter(j => BLUE_COLLAR_SET.has(j.cat) && isActiveStatus(j.jobStatus)).slice(0, limit)
}
