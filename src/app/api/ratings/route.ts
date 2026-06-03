import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export async function POST(req: NextRequest) {
  const { score, page = "contact" } = await req.json()
  if (!score || score < 1 || score > 5) return NextResponse.json({ error: "Invalid score" }, { status: 400 })
  if (!isSupabaseConfigured()) return NextResponse.json({ success: true })
  const api = await requireApiSupabase()
  if (api.error) return NextResponse.json({ success: true })
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  await sb.from("ratings").insert({ score, page, user_id: user?.id || null })
  return NextResponse.json({ success: true })
}
