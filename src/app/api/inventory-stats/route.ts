import { NextResponse } from "next/server"
import { getVisibleBoardCounts, getVisibleAbroadCountryCounts } from "@/lib/services/visibleCounts"
import { getGenuineJobCounts } from "@/lib/services/genuineCounts"

export const dynamic = "force-dynamic"

/**
 * Lightweight counts for heroes/stats (no full job payloads).
 *
 * COUNT INTEGRITY — both buckets are computed AFTER filtering, never over raw rows:
 *  • `catalog` = the browsable lists exactly as candidates see them (renderable records
 *    only, the admin "synthetic jobs visible" switch honoured). It includes sample
 *    listings, so it is a "roles to explore" figure — NOT a genuine-openings claim.
 *  • `genuine` = genuine + open + renderable jobs (the sitemap's predicate).
 */
export async function GET() {
  const [visible, countries, genuine] = await Promise.all([
    getVisibleBoardCounts(),
    getVisibleAbroadCountryCounts(),
    getGenuineJobCounts(),
  ])
  return NextResponse.json({
    catalog: {
      opportunities: visible.total.all,
      liveJobs: visible.total.live,
      verifiedJobs: visible.total.verified,
      archivedJobs: visible.total.archived,
      private: visible.private,
      wfh: visible.wfh,
      abroad: visible.abroad,
    },
    genuine: { opportunities: genuine.total, liveJobs: genuine.total, private: genuine.private, wfh: genuine.wfh, abroad: genuine.abroad, govt: genuine.govt },
    private: visible.private,
    wfh: visible.wfh,
    abroad: visible.abroad,
    countries,
  })
}
