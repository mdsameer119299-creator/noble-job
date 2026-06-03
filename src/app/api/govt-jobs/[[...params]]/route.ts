import { NextRequest, NextResponse } from "next/server"
import { useLocalInventoryOnly } from "@/lib/supabase/useLocalInventory"
import {
  getGovtJobsLocal,
  getGovtJobByIdLocal,
  getGovtStatsLocal,
} from "@/lib/services/govtJobLocal"
import type { GovtJobTab } from "@/types/govtJob"

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const { params: p } = await params
  const sp = req.nextUrl.searchParams
  const tab = (sp.get("tab") || "latest") as GovtJobTab
  const state = sp.get("state") || undefined

  try {
    if (p?.[0] === "stats") {
      if (useLocalInventoryOnly()) {
        return NextResponse.json(getGovtStatsLocal())
      }
      const { getGovtStats } = await import("@/lib/services/govtJobService")
      return NextResponse.json(await getGovtStats())
    }

    if (p?.length === 1 && !["stats", "states"].includes(p[0])) {
      if (useLocalInventoryOnly()) {
        const job = getGovtJobByIdLocal(p[0])
        if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
        return NextResponse.json({ data: job })
      }
      const { getGovtJobById } = await import("@/lib/services/govtJobService")
      const job = await getGovtJobById(p[0])
      if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ data: job })
    }

    if (useLocalInventoryOnly()) {
      const jobs = getGovtJobsLocal(tab, state)
      return NextResponse.json(
        { data: jobs, total: jobs.length },
        { headers: CACHE_HEADERS },
      )
    }

    const { getGovtJobs } = await import("@/lib/services/govtJobService")
    const jobs = await getGovtJobs(tab, state)
    return NextResponse.json(
      { data: jobs, total: jobs.length },
      { headers: CACHE_HEADERS },
    )
  } catch (err) {
    console.error("[govt-jobs]", err)
    if (err instanceof Error) {
      console.error("[govt-jobs] stack:", err.stack)
    }
    const jobs = getGovtJobsLocal(tab, state)
    return NextResponse.json(
      { data: jobs, total: jobs.length },
      { headers: CACHE_HEADERS },
    )
  }
}
