import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { alertSubscribeSchema } from "@/lib/validations/alertSchema"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = alertSubscribeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 })
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true })
  }
  try {
    const sb = await createClient()
    if (!sb) return NextResponse.json({ success: true })
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from("job_alerts").insert({ ...parsed.data, user_id: user?.id || null })
    return NextResponse.json({ success: !error })
  } catch {
    return NextResponse.json({ success: true })
  }
}

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ data: [] })
  try {
  const sb = await createClient()
  if (!sb) return NextResponse.json({ data: [] })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ data: [] })
  const { data } = await sb.from("job_alerts").select("*").eq("user_id", user.id).eq("is_active", true)
  return NextResponse.json({ data: data || [] })
  } catch {
    return NextResponse.json({ data: [] })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
  const sb = await createClient()
  if (!sb) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { params: p } = await params
  const id = p?.[0]
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
  const { error } = await sb.from("job_alerts").update({ is_active: false }).eq("id", id).eq("user_id", user.id)
  return NextResponse.json({ success: !error })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
