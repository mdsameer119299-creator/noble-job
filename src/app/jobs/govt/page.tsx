import { CategoryHero } from "@/components/heroes/CategoryHero"
import { GovtJobsPageClient } from "@/components/govt/GovtJobsPageClient"
import { GovtStats } from "@/components/govt/GovtStats"
import { GovtNavGrids } from "@/components/govt/GovtNavGrids"
import { ScrollToTop } from "@/components/shared/ScrollToTop"
import { getGovtJobs } from "@/lib/services/govtJobService"
import { getGovtPoolStatus } from "@/lib/services/govtStatsSource"
import { listingMeta } from "@/lib/seo/metadata"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

const HUB_INITIAL_COUNT = 24

type SP = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// Page-1 metadata comes from layout.tsx. page>=2 and filter/keyword params →
// noindex,follow (same policy as the other boards). While the data source is
// unavailable the board is noindexed so an empty shell is never indexed.
export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const meta = listingMeta("/jobs/govt", await searchParams)
  if ((await getGovtPoolStatus()).unavailable) {
    return { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
  }
  return meta
}

export default async function GovtJobsPage() {
  const initialJobs = (await getGovtJobs("latest")).slice(0, HUB_INITIAL_COUNT)
  const status = await getGovtPoolStatus()

  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <CategoryHero variant="govt" />
      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
        {status.unavailable && (
          <div role="status" style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", color: "#9a3412", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
            Government job listings are temporarily unavailable. Please check back shortly — we do not show
            outdated or sample notifications in their place.
          </div>
        )}
        <GovtStats />
        <GovtNavGrids />
        <GovtJobsPageClient initialJobs={initialJobs} />
      </div>
      <ScrollToTop />
    </div>
  )
}
