import { NextRequest, NextResponse } from "next/server"
import { useLocalInventoryOnly } from "@/lib/supabase/useLocalInventory"
import {
  getAbroadJobsPaginatedLocal,
  getAbroadJobByIdLocal,
  type AbroadJobFilters,
} from "@/lib/services/abroadJobLocal"
import { isSyntheticJobsVisible } from "@/lib/jobs/syntheticVisibility"

function listFromQuery(sp: URLSearchParams, syntheticVisible: boolean) {
  const filters: AbroadJobFilters = {
    q: sp.get("q") || "",
    country: sp.get("country") || "",
    category: sp.get("category") || "",
    status: (sp.get("status") || undefined) as AbroadJobFilters["status"],
    page: Number(sp.get("page") || 1),
    limit: Number(sp.get("limit") || 20),
  }
  return getAbroadJobsPaginatedLocal(filters, syntheticVisible)
}

function jsonFromResult(result: ReturnType<typeof getAbroadJobsPaginatedLocal>) {
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
        const job = getAbroadJobByIdLocal(p[0], syntheticVisible)
        if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
        return NextResponse.json({ data: job })
      }
      const { getAbroadJobById } = await import("@/lib/services/abroadJobService")
      const job = await getAbroadJobById(p[0])
      if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ data: job })
    }

    if (useLocalInventoryOnly()) {
      return jsonFromResult(listFromQuery(sp, syntheticVisible))
    }

    const { getAbroadJobsPaginated } = await import("@/lib/services/abroadJobService")
    return jsonFromResult(
      await getAbroadJobsPaginated({
        q: sp.get("q") || "",
        country: sp.get("country") || "",
        category: sp.get("category") || "",
        status: (sp.get("status") || undefined) as AbroadJobFilters["status"],
        page: Number(sp.get("page") || 1),
        limit: Number(sp.get("limit") || 20),
      }),
    )
  } catch (err) {
    console.error("[abroad-jobs]", err)
    if (err instanceof Error) console.error("[abroad-jobs] stack:", err.stack)
    return jsonFromResult(listFromQuery(sp, syntheticVisible))
  }
}
