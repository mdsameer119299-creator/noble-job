/**
 * Govt hub stat counters — sourced from the database (active govt_jobs rows). No fabricated vacancy totals: the vacancy
 * counter exists only when every figure behind it is affirmatively verified (see data/govtVacancies.ts), and is omitted
 * otherwise. The arithmetic lives in govt/hubCounts.ts (pure, unit-tested); this file only reads the pool.
 */
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import { buildGovtHubStats, type GovtHubStatItem } from "@/lib/govt/hubCounts"

export type { GovtHubStatItem }

export async function getGovtHubStats(opts?: { slug?: string }): Promise<GovtHubStatItem[]> {
  return buildGovtHubStats(await getActiveGovtRows(), opts?.slug)
}
