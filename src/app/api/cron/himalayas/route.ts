import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/security/cronAuth"
import { refreshHimalayasCache } from "@/services/himalayasCronService"
import { ingestHimalayasWfhJobs } from "@/lib/services/himalayasWfhIngest"
import { ingestHimalayasAbroadJobs } from "@/lib/services/himalayasAbroadIngest"

/**
 * Scheduled Himalayas refresh — GET /api/cron/himalayas.
 *
 * Vercel Cron always sends a GET request (see vercel.json), matching the
 * existing /api/cron/govt-jobs convention — the previously-added POST handler
 * on /api/external/jobs is never actually invoked by Vercel Cron and is left
 * as-is for any other manual/authenticated trigger.
 *
 * Runs ALL Himalayas refresh paths:
 *  1. refreshHimalayasCache() — the existing himalayas_jobs_cache table that
 *     backs the client-side Private-board "live jobs" overlay (unchanged).
 *  2. ingestHimalayasWfhJobs() — DB-backed WFH ingestion: writes genuine
 *     AGGREGATED rows into wfh_jobs with dedup + stale-closing.
 *  3. ingestHimalayasAbroadJobs() — DB-backed Abroad ingestion: writes genuine
 *     international (non-India) AGGREGATED rows into abroad_jobs with dedup +
 *     stale-closing. Same API, inverted geo-filter.
 *
 * Example Vercel cron (vercel.json):
 *   { "crons": [{ "path": "/api/cron/himalayas", "schedule": "0 3 * * *" }] }
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  return isCronAuthorized(req.headers.get("authorization"))
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const [cacheRefreshed, wfhIngest, abroadIngest] = await Promise.all([
      refreshHimalayasCache(),
      ingestHimalayasWfhJobs(),
      ingestHimalayasAbroadJobs(),
    ])
    return NextResponse.json({ ok: true, cacheRefreshed, wfhIngest, abroadIngest })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
