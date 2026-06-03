import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"

export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { error, data } = await sb.from("interviews").insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { params: p } = await params
  const id = p?.[0]
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
  const body = await req.json()
  const { error } = await sb.from("interviews").update(body).eq("id", id)
  return NextResponse.json({ success: !error })
}
