import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/** Public stats contain only counts backed by genuine, actionable data. */
export async function GET() {
  const empty = {
    totalJobs: 0,
    catalogJobs: 0,
    totalCompanies: 0,
    totalPlaced: 0,
    totalPartners: 0,
    totalRecruiters: 0,
  }

  if (!isSupabaseConfigured()) return NextResponse.json(empty)

  try {
    const sb = await createClient()
    if (!sb) throw new Error("skip")
    const { getGenuineJobCounts } = await import("@/lib/services/genuineCounts")
    const [genuine, employers, applications] = await Promise.all([
      getGenuineJobCounts(),
      sb.from("employers").select("id", { count: "exact", head: true }).eq("verified", true),
      sb.from("applications").select("id", { count: "exact", head: true }).eq("status", "hired"),
    ])
    return NextResponse.json({
      totalJobs: genuine.total,
      catalogJobs: genuine.total,
      totalCompanies: employers.count || 0,
      totalPlaced: applications.count || 0,
      totalPartners: employers.count || 0,
      totalRecruiters: employers.count || 0,
    })
  } catch {
    return NextResponse.json(empty)
  }
}
