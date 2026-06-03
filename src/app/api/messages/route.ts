import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { getMessages, sendMessage } from "@/lib/services/messageService"

export async function GET() {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const messages = await getMessages(user.id)
  return NextResponse.json({ data: messages })
}

export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { recipientId, content, applicationId } = await req.json()
  try {
    const message = await sendMessage(user.id, recipientId, content, applicationId)
    return NextResponse.json({ data: message })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send message"
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
