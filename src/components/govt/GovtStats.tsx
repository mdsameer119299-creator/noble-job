import { getGovtHubStats } from '@/lib/services/govtHubStats'
import { GovtStatsClient } from './GovtStatsClient'

/** Server-rendered stats strip (avoids bundling full job inventory on the client). */
export function GovtStats() {
  return <GovtStatsClient items={getGovtHubStats()} />
}
