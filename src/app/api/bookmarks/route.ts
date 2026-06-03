import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"

export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { job_id, board } = await req.json()
  const { error } = await sb.from("bookmarks").upsert({ user_id: user.id, job_id, board }, { onConflict: "user_id,job_id,board" })
  return NextResponse.json({ success: !error })
}

export async function DELETE(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { job_id, board } = await req.json()
  const { error } = await sb.from("bookmarks").delete().eq("user_id", user.id).eq("job_id", job_id).eq("board", board)
  return NextResponse.json({ success: !error })
}
