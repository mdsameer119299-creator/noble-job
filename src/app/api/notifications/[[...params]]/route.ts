import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getNotifications, markNotificationRead } from "@/lib/services/notificationService"

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ data: [] })
  const api = await requireApiSupabase()
  if (api.error) return NextResponse.json({ data: [] })
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ data: [] })
  const notifications = await getNotifications(user.id)
  return NextResponse.json({ data: notifications })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const { params: p } = await params
  if (!p?.[0]) return NextResponse.json({ error: "ID required" }, { status: 400 })
  await markNotificationRead(p[0])
  return NextResponse.json({ success: true })
}
