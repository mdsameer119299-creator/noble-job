import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { isSupabaseConfigured } from "@/lib/supabase/config"

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
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { job_id, board } = await req.json()
  const { data: candidate } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ error: "No candidate profile" }, { status: 404 })
  const { error } = await sb.from("saved_jobs").upsert({ candidate_id: (candidate as { id: string }).id, job_id, board }, { onConflict: "candidate_id,job_id,board" })
  return NextResponse.json({ success: !error })
}
