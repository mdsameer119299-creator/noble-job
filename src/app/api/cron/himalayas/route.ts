import { NextRequest, NextResponse } from "next/server"
import { refreshHimalayasCache } from "@/services/himalayasCronService"
import { ingestHimalayasWfhJobs } from "@/lib/services/himalayasWfhIngest"

/**
 * Scheduled Himalayas refresh — GET /api/cron/himalayas.
 *
 * Vercel Cron always sends a GET request (see vercel.json), matching the
 * existing /api/cron/govt-jobs convention — the previously-added POST handler
 * on /api/external/jobs is never actually invoked by Vercel Cron and is left
 * as-is for any other manual/authenticated trigger.
 *
 * Runs BOTH real Himalayas refresh paths:
 *  1. refreshHimalayasCache() — the existing himalayas_jobs_cache table that
 *     backs the client-side Private-board "live jobs" overlay (unchanged).
 *  2. ingestHimalayasWfhJobs() — the new DB-backed WFH ingestion (Phase 1C /
 *     Phase 2): writes genuine AGGREGATED rows into wfh_jobs, with dedup,
 *     honest source dates, and closing of jobs no longer returned.
 *
 * Example Vercel cron (vercel.json):
 *   { "crons": [{ "path": "/api/cron/himalayas", "schedule": "0 3 * * *" }] }
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail CLOSED in production: a missing secret must never leave this
    // ingestion endpoint publicly callable. Allowed only outside production
    // so local dev without a secret still works (mirrors /api/cron/govt-jobs).
    return process.env.NODE_ENV !== "production"
  }
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const [cacheRefreshed, wfhIngest] = await Promise.all([
      refreshHimalayasCache(),
      ingestHimalayasWfhJobs(),
    ])
    return NextResponse.json({ ok: true, cacheRefreshed, wfhIngest })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
