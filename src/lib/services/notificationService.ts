import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { Notification } from "@/types/notification"

export async function getNotifications(userId: string): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return []
  const sb = await createClient()
  if (!sb) return []
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
  return (data || []) as unknown as Notification[]
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string
) {
  if (!isSupabaseConfigured()) return { error: null }
  const sb = await createClient()
  if (!sb) return { error: null }
  return sb.from("notifications").insert({ user_id: userId, type, title, message })
}

export async function markNotificationRead(id: string) {
  if (!isSupabaseConfigured()) return { error: null }
  const sb = await createClient()
  if (!sb) return { error: null }
  return sb.from("notifications").update({ is_read: true }).eq("id", id)
}
