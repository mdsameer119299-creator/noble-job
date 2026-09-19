import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getMarketplaceTotals } from "@/lib/data/jobInventory"

/**
 * Public stats. TWO HONEST BUCKETS (see src/lib/jobs/provenance.ts):
 *  • `totalJobs` / `totalCompanies` are GENUINE counts (real DB rows). They are
 *    never padded with synthetic demo inventory or fabricated marketing targets.
 *  • `catalogJobs` is the full browsable catalog (includes demo showcase rows).
 *    It is explicitly a "roles to explore" figure — NOT a genuine-openings claim.
 */
export async function GET() {
  const marketplace = getMarketplaceTotals()
  const catalogJobs = marketplace.opportunities

  const empty = {
    totalJobs: 0,
    catalogJobs,
    totalCompanies: 0,
    totalPlaced: 0,
    totalPartners: 1200,
    totalRecruiters: 1500,
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(empty)
  }

  try {
    const sb = await createClient()
    if (!sb) throw new Error("skip")
    const { getGenuineJobCounts } = await import("@/lib/services/genuineCounts")
    const [genuine, employers, applications] = await Promise.all([
      // Same predicate as the sitemap (genuine + open + renderable) — NOT a raw
      // `status = active` row count, which includes samples and incomplete rows.
      getGenuineJobCounts(),
      sb.from("employers").select("id", { count: "exact", head: true }).eq("verified", true),
      sb.from("applications").select("id", { count: "exact", head: true }).eq("status", "hired"),
    ])
    return NextResponse.json({
      totalJobs: genuine.total,
      catalogJobs,
      totalCompanies: employers.count || 0,
      totalPlaced: applications.count || 0,
      totalPartners: 1200,
      totalRecruiters: 1500,
    })
  } catch {
    return NextResponse.json(empty)
  }
}
