import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/security/cronAuth"
import { runGovtAutoUpdate, getGovtIngestMetrics } from "@/lib/services/govtAutoUpdate"

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
// Run from Mumbai so adapter fetches egress from an India IP (several gov
// portals block/timeout non-India clouds). Raise maxDuration to 300 on Vercel
// Pro; 60 is the Hobby ceiling. Headless/curl-only portals (RPSC, KPSC, BPSC)
// run in GitHub Actions instead — see .github/workflows/govt-ingest.yml.
export const preferredRegion = "bom1"
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  return isCronAuthorized(req.headers.get("authorization"))
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
