import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { resolveSavedJob, normalizeSavedBoard } from "@/lib/services/savedJobsResolver"

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ data: [] })
  const api = await requireApiSupabase()
  if (api.error) return NextResponse.json({ data: [] })
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ data: [] })
  const { data: candidate } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ data: [] })
  const { data } = await sb.from("saved_jobs").select("*").eq("candidate_id", (candidate as { id: string }).id).order("saved_at", { ascending: false })
  // NO EMPTY JOBS: a saved reference is listed only while it still resolves to a
  // renderable job (same by-id services as the detail pages). Stored rows are untouched.
  const rows = (data || []) as Array<{ id: string; job_id: string; board?: string; saved_at?: string }>
  const resolved = await Promise.all(rows.map(async r => {
    const job = await resolveSavedJob(r.job_id, r.board ?? "private")
    return job ? { id: r.id, saved_at: r.saved_at, ...job } : null
  }))
  return NextResponse.json({ data: resolved.filter(Boolean) })
}

export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const board = normalizeSavedBoard(body?.board)
  const job_id = body?.job_id
  // Only a real, renderable job can be saved (no "undefined"/path ids, no hidden or incomplete records).
  if (!board || !(await resolveSavedJob(job_id, board))) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }
  const { data: candidate } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ error: "No candidate profile" }, { status: 404 })
  const { error } = await sb.from("saved_jobs").upsert({ candidate_id: (candidate as { id: string }).id, job_id, board }, { onConflict: "candidate_id,job_id,board" })
  return NextResponse.json({ success: !error })
}
