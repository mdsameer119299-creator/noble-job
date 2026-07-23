import { NextRequest, NextResponse } from "next/server"
import { useLocalInventoryOnly } from "@/lib/supabase/useLocalInventory"
import { isSyntheticJobsVisible } from "@/lib/jobs/syntheticVisibility"
import {
  getPrivateJobsLocal,
  getPrivateJobByIdLocal,
  getPrivateJobsFeaturedLocal,
  getPrivateJobsCountLocal,
} from "@/lib/services/jobLocal"

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const { params: p } = await params
  const sp = req.nextUrl.searchParams
  const syntheticVisible = await isSyntheticJobsVisible()

  try {
    if (p?.length === 1 && p[0] !== "live" && p[0] !== "featured" && p[0] !== "count") {
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
      try {
        const { getHimalayasJobsForDisplay } = await import("@/lib/services/himalayasCache")
        const jobs = await getHimalayasJobsForDisplay(100)
        return NextResponse.json(
          { data: jobs },
          { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
        )
      } catch {
        return NextResponse.json({ data: [] })
      }
    }

    if (p?.[0] === "featured") {
      if (useLocalInventoryOnly()) {
        return NextResponse.json({ data: getPrivateJobsFeaturedLocal(4, syntheticVisible) })
      }
      const { createClient } = await import("@/lib/supabase/server")
      const sb = await createClient()
      if (!sb) return NextResponse.json({ data: getPrivateJobsFeaturedLocal(4, syntheticVisible) })
      const { data } = await sb
        .from("jobs")
        .select("*")
        .eq("status", "active")
        .order("posted_at", { ascending: false })
        .limit(4)
      return NextResponse.json({ data: data?.length ? data : getPrivateJobsFeaturedLocal(4, syntheticVisible) })
    }

    if (p?.[0] === "count") {
      if (useLocalInventoryOnly()) {
        return NextResponse.json({ count: getPrivateJobsCountLocal(syntheticVisible) })
      }
      const { createClient } = await import("@/lib/supabase/server")
      const sb = await createClient()
      if (!sb) return NextResponse.json({ count: getPrivateJobsCountLocal(syntheticVisible) })
      const { count } = await sb.from("jobs").select("id", { count: "exact" }).eq("status", "active")
      return NextResponse.json({ count: count || getPrivateJobsCountLocal(syntheticVisible) })
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
