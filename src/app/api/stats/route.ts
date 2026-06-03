import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getMarketplaceTotals } from "@/lib/data/jobInventory"
import { JOB_STRATEGY_PHASE } from "@/lib/config/jobStrategy"

export async function GET() {
  const marketplace = getMarketplaceTotals()

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      totalJobs: marketplace.opportunities,
      totalCompanies: JOB_STRATEGY_PHASE.targets.verifiedEmployers,
      totalPlaced: 0,
      totalPartners: 1200,
      totalRecruiters: 1500,
    })
  }

  try {
    const sb = await createClient()
    if (!sb) throw new Error("skip")
    const [jobs, employers, applications, wfh, govt, abroad] = await Promise.all([
      sb.from("jobs").select("id", { count: "exact" }).eq("status", "active"),
      sb.from("employers").select("id", { count: "exact" }),
      sb.from("applications").select("id", { count: "exact" }).eq("status", "hired"),
      sb.from("wfh_jobs").select("id", { count: "exact" }).eq("status", "active"),
      sb.from("govt_jobs").select("id", { count: "exact" }).eq("status", "active"),
      sb.from("abroad_jobs").select("id", { count: "exact" }).eq("status", "active"),
    ])
    const dbTotal =
      (jobs.count || 0) + (wfh.count || 0) + (govt.count || 0) + (abroad.count || 0)
    return NextResponse.json({
      totalJobs: Math.max(dbTotal, marketplace.opportunities),
      totalCompanies: Math.max(employers.count || 0, JOB_STRATEGY_PHASE.targets.verifiedEmployers),
      totalPlaced: applications.count || 0,
      totalPartners: 1200,
      totalRecruiters: 1500,
    })
  } catch {
    return NextResponse.json({
      totalJobs: marketplace.opportunities,
      totalCompanies: JOB_STRATEGY_PHASE.targets.verifiedEmployers,
      totalPlaced: 0,
      totalPartners: 1200,
      totalRecruiters: 1500,
    })
  }
}
