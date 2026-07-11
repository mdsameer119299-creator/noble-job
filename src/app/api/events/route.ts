import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { Json } from "@/types/supabase"

export const runtime = "nodejs"

/**
 * POST /api/events — first-party analytics sink for the acquisition funnel.
 *
 * Best-effort and FAIL-SAFE: it never throws and never blocks the client. It
 * persists to `analytics_events` when that table exists; if the table is absent
 * (migration not yet applied) or the DB is unreachable, it silently no-ops with
 * a 200 so tracking can never break a user flow or a deploy.
 */

const ALLOWED = new Set([
  "resume_cta_opened",
  "resume_upload",
  "resume_parsed",
  "resume_score_generated",
  "resume_mode_selected",
  "job_alert_subscribed",
  "first_application",
])

type Body = {
  event?: unknown
  props?: unknown
  path?: unknown
  sid?: unknown
  ts?: unknown
}

export async function POST(req: NextRequest) {
  // sendBeacon may send text/plain; parse defensively.
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    try {
      body = JSON.parse(await req.text()) as Body
    } catch {
      return NextResponse.json({ ok: true })
    }
  }

  const event = typeof body.event === "string" ? body.event : ""
  if (!ALLOWED.has(event)) return NextResponse.json({ ok: true }) // ignore unknown/noise

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true })

  try {
    const sb = await createClient()
    if (!sb) return NextResponse.json({ ok: true })
    const { data: { user } } = await sb.auth.getUser()
    await sb.from("analytics_events").insert({
      event,
      props: (body.props && typeof body.props === "object" ? body.props : {}) as Json,
      path: typeof body.path === "string" ? body.path.slice(0, 512) : null,
      session_id: typeof body.sid === "string" ? body.sid.slice(0, 128) : null,
      user_id: user?.id ?? null,
    })
  } catch {
    /* table missing / DB down → silently drop */
  }
  return NextResponse.json({ ok: true })
}
