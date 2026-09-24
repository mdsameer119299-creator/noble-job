import { NextRequest, NextResponse } from "next/server"
import { useLocalInventoryOnly } from "@/lib/supabase/useLocalInventory"
import { isSyntheticJobsVisible } from "@/lib/jobs/syntheticVisibility"
import { isValidJobId } from "@/lib/jobs/renderable"
import {
  getPrivateJobsLocal,
  getPrivateJobByIdLocal,
  getPrivateJobsFeaturedLocal,
} from "@/lib/services/jobLocal"

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const { params: p } = await params
  const sp = req.nextUrl.searchParams
  const syntheticVisible = await isSyntheticJobsVisible()

  try {
    if (p?.length === 1 && p[0] !== "live" && p[0] !== "featured" && p[0] !== "count") {
      if (!isValidJobId(p[0])) return NextResponse.json({ error: "Not found" }, { status: 404 })
      if (useLocalInventoryOnly()) {
        const job = getPrivateJobByIdLocal(p[0], syntheticVisible)
        if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
        return NextResponse.json({ data: job })
      }
      const { getJobById } = await import("@/lib/services/jobService")
      const job = await getJobById(p[0])
      if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ data: job })
    }

    if (p?.[0] === "live") {
      // Candidate-facing private listings use the same employer-direct India
      // feed as the server job service. This avoids falling back to the old
      // remote-only Himalayas cache and accidentally mixing unrelated/sample data.
      const { getLivePrivateJobs } = await import("@/lib/services/liveJobOpportunities")
      const jobs = await getLivePrivateJobs()
      return NextResponse.json(
        { data: jobs },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
      )
    }

    if (p?.[0] === "featured") {
      const { getFeaturedPrivateJobs } = await import("@/lib/services/featuredJobs")
      return NextResponse.json({ data: await getFeaturedPrivateJobs(4) })
    }

    if (p?.[0] === "count") {
      const { getJobs } = await import("@/lib/services/jobService")
      const { counts } = await getJobs({ page: 1, limit: 1 })
      return NextResponse.json({ count: Math.max(0, (counts?.all ?? 0) - (counts?.archived ?? 0)) })
    }

    const filter = {
      q: sp.get("q") || "",
      category: sp.get("category") || "",
      location: sp.get("location") || "",
      exp: sp.get("exp") || "",
      type: sp.get("type") || "",
      status: (sp.get("status") || undefined) as "LIVE_JOB" | "VERIFIED_JOB" | "ARCHIVED_JOB" | undefined,
      sort: (sp.get("sort") || "latest") as "latest" | "salary_high",
      page: Number(sp.get("page") || 1),
      limit: Number(sp.get("limit") || 20),
    }

    if (useLocalInventoryOnly()) {
      return NextResponse.json(getPrivateJobsLocal(filter, syntheticVisible))
    }

    const { getJobs } = await import("@/lib/services/jobService")
    const result = await getJobs(filter)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[api/jobs]", err)
    if (err instanceof Error) console.error("[api/jobs] stack:", err.stack)
    return NextResponse.json(getPrivateJobsLocal({
      q: sp.get("q") || "",
      category: sp.get("category") || "",
      location: sp.get("location") || "",
      exp: sp.get("exp") || "",
      type: sp.get("type") || "",
      page: Number(sp.get("page") || 1),
      limit: Number(sp.get("limit") || 20),
    }, syntheticVisible))
  }
}
