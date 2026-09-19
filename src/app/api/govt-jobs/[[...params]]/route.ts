import { NextRequest, NextResponse } from "next/server"
import { getGovtJobsLocal } from "@/lib/services/govtJobLocal"
import { isGovtSeedFallbackAllowed } from "@/lib/config/govtSeedPolicy"
import { isServableGovtJob } from "@/lib/services/govtStatsSource"
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
    // All govt reads are DB-first (with local fallback baked into the services).
    if (p?.[0] === "stats") {
      const { getGovtStats } = await import("@/lib/services/govtJobService")
      return NextResponse.json(await getGovtStats())
    }

    if (p?.length === 1 && !["stats", "states"].includes(p[0])) {
      const { getGovtJobById } = await import("@/lib/services/govtJobService")
      const job = await getGovtJobById(p[0])
      if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ data: job })
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
    // A failure on a SINGLE-JOB request must never be answered with a list (the
    // caller would render an unrelated/empty job). A failure on a list request only
    // falls back to the demo seed where policy allows it, and even then only to
    // records that are complete enough to be jobs.
    if (p?.length === 1 && !["stats", "states"].includes(p[0])) {
      return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 })
    }
    const jobs = isGovtSeedFallbackAllowed() ? getGovtJobsLocal(tab, state).filter(isServableGovtJob) : []
    return NextResponse.json(
      { data: jobs, total: jobs.length },
      { status: jobs.length ? 200 : 503, headers: jobs.length ? CACHE_HEADERS : { "Cache-Control": "no-store" } },
    )
  }
}
