import { NextRequest, NextResponse } from "next/server"
import { runGovtAutoUpdate, getGovtIngestMetrics } from "@/lib/services/govtAutoUpdate"
import { SCHEDULER_CONFIG } from "@/lib/config/govtSources"

/**
 * Daily government-jobs auto-update endpoint.
 *
 * Schedule with any cron runner (Vercel Cron, GitHub Actions, external) hitting:
 *   GET /api/cron/govt-jobs   with header  Authorization: Bearer <CRON_SECRET>
 *
 * Example Vercel cron (vercel.json):
 *   { "crons": [{ "path": "/api/cron/govt-jobs", "schedule": "0 6 * * *" }] }
 */
export const dynamic = "force-dynamic"

function authorized(req: NextRequest): boolean {
  const secret = process.env[SCHEDULER_CONFIG.secretEnvVar]
  if (!secret) return true // no secret configured → allow (dev convenience)
  const header = req.headers.get("authorization") || ""
  return header === `Bearer ${secret}` || req.nextUrl.searchParams.get("secret") === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    // Read-only monitoring snapshot (does not run a sync).
    if (req.nextUrl.searchParams.get("metrics") === "1") {
      return NextResponse.json({ ok: true, metrics: await getGovtIngestMetrics() })
    }
    const result = await runGovtAutoUpdate()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
