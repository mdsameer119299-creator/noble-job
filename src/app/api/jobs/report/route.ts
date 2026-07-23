import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const runtime = "nodejs"

const ALLOWED_BOARDS = new Set(["private", "wfh", "abroad", "govt"])
const ALLOWED_REASONS = new Set([
  "fake_or_spam",
  "asks_for_money",
  "expired_but_showing",
  "discriminatory",
  "other",
])

type Body = {
  board?: unknown
  jobId?: unknown
  jobTitle?: unknown
  reason?: unknown
  note?: unknown
}

export async function POST(req: NextRequest) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const board = typeof body.board === "string" ? body.board : ""
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason : ""
  if (!ALLOWED_BOARDS.has(board) || !jobId || !ALLOWED_REASONS.has(reason)) {
    return NextResponse.json({ error: "Missing or invalid board, jobId, or reason" }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Reporting is temporarily unavailable" }, { status: 503 })
  }

  try {
    const sb = await createClient()
    if (!sb) return NextResponse.json({ error: "Reporting is temporarily unavailable" }, { status: 503 })
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from("job_reports").insert({
      board,
      job_id: jobId,
      job_title: typeof body.jobTitle === "string" ? body.jobTitle.slice(0, 300) : null,
      reason,
      note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
      reporter_user_id: user?.id ?? null,
    })
    if (error) return NextResponse.json({ error: "Could not submit report" }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Could not submit report" }, { status: 500 })
  }
}
