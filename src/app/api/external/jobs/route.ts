import { NextRequest, NextResponse } from "next/server"
import { refreshHimalayasCache } from "@/services/himalayasCronService"
import { getHimalayasJobsForDisplay } from "@/lib/services/himalayasCache"

// Called by Vercel Cron every hour — POST /api/external/jobs
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "")
    const q = req.nextUrl.searchParams.get("secret")
    if (auth !== secret && q !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  const count = await refreshHimalayasCache()
  return NextResponse.json({ success: true, refreshed: count })
}

export async function GET() {
  const jobs = await getHimalayasJobsForDisplay(100)
  return NextResponse.json(
    { data: jobs, total: jobs.length, source: jobs.length ? "cache-or-live" : "empty" },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
  )
}
