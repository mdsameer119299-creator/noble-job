import { getGovtHubStats } from '@/lib/services/govtHubStats'
import { GovtStatsClient } from './GovtStatsClient'

/** Server-rendered stats strip (avoids bundling full job inventory on the client). */
export async function GovtStats() {
  return <GovtStatsClient items={await getGovtHubStats()} />
}
