import { CategoryHero } from "@/components/heroes/CategoryHero"
import { GovtJobsPageClient } from "@/components/govt/GovtJobsPageClient"
import { GovtStats } from "@/components/govt/GovtStats"
import { GovtNavGrids } from "@/components/govt/GovtNavGrids"
import { ScrollToTop } from "@/components/shared/ScrollToTop"
import { getGovtJobs } from "@/lib/services/govtJobService"

export const dynamic = "force-dynamic"

const HUB_INITIAL_COUNT = 24

export default async function GovtJobsPage() {
  const initialJobs = (await getGovtJobs("latest")).slice(0, HUB_INITIAL_COUNT)

  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <CategoryHero variant="govt" />
      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <GovtStats />
        <GovtNavGrids />
        <GovtJobsPageClient initialJobs={initialJobs} />
      </div>
      <ScrollToTop />
    </div>
  )
}
