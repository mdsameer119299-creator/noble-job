import { NextRequest, NextResponse } from "next/server"
import { useLocalInventoryOnly } from "@/lib/supabase/useLocalInventory"
import { getWfhJobsPaginatedLocal, getWfhJobByIdLocal } from "@/lib/services/wfhJobLocal"
import { isSyntheticJobsVisible } from "@/lib/jobs/syntheticVisibility"
import type { WfhJobFilters } from "@/lib/services/wfhJobLocal"

function listFromQuery(sp: URLSearchParams, syntheticVisible: boolean) {
  const filters: WfhJobFilters = {
    q: sp.get("q") || "",
    cat: sp.get("cat") || "all",
    exp: sp.get("exp") || "all",
    sort: sp.get("sort") || "latest",
    status: (sp.get("status") || undefined) as WfhJobFilters["status"],
    page: Number(sp.get("page") || 1),
    limit: Number(sp.get("limit") || 20),
  }
  return getWfhJobsPaginatedLocal(filters, syntheticVisible)
}

function jsonFromResult(result: ReturnType<typeof getWfhJobsPaginatedLocal>) {
  return NextResponse.json({
    data: result.items,
    jobs: result.items,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    counts: result.counts,
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const sp = req.nextUrl.searchParams
  const syntheticVisible = await isSyntheticJobsVisible()

  try {
    const { params: p } = await params

    if (p?.length === 1) {
      if (useLocalInventoryOnly()) {
        const job = getWfhJobByIdLocal(p[0], syntheticVisible)
        if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
        return NextResponse.json({ data: job })
      }
      const { getWfhJobById } = await import("@/lib/services/wfhJobService")
      const job = await getWfhJobById(p[0])
      if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ data: job })
    }

    if (useLocalInventoryOnly()) {
      return jsonFromResult(listFromQuery(sp, syntheticVisible))
    }

    const { getWfhJobsPaginated } = await import("@/lib/services/wfhJobService")
    const result = await getWfhJobsPaginated({
      q: sp.get("q") || "",
      cat: sp.get("cat") || "all",
      exp: sp.get("exp") || "all",
      sort: sp.get("sort") || "latest",
      status: (sp.get("status") || undefined) as WfhJobFilters["status"],
      page: Number(sp.get("page") || 1),
      limit: Number(sp.get("limit") || 20),
    })
    return jsonFromResult(result)
  } catch (err) {
    console.error("[wfh-jobs]", err)
    if (err instanceof Error) console.error("[wfh-jobs] stack:", err.stack)
    return jsonFromResult(listFromQuery(sp, syntheticVisible))
  }
}
