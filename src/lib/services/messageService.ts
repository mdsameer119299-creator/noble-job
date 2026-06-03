import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { Message } from "@/types/message"

export async function getMessages(userId: string): Promise<Message[]> {
  if (!isSupabaseConfigured()) return []
  const sb = await createClient()
  if (!sb) return []
  const { data } = await sb
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("sent_at", { ascending: false })
  return (data || []) as unknown as Message[]
}

export async function sendMessage(
  senderId: string,
  recipientId: string,
  content: string,
  applicationId?: string
) {
  if (!isSupabaseConfigured()) throw new Error("Messages unavailable until Supabase is configured")
  const sb = await createClient()
  if (!sb) throw new Error("Messages unavailable until Supabase is configured")
  const { data, error } = await sb
    .from("messages")
    .insert({ sender_id: senderId, recipient_id: recipientId, content, application_id: applicationId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markMessagesRead(userId: string, senderId: string) {
  if (!isSupabaseConfigured()) return { error: null }
  const sb = await createClient()
  if (!sb) return { error: null }
  return sb
    .from("messages")
    .update({ is_read: true })
    .eq("recipient_id", userId)
    .eq("sender_id", senderId)
    .eq("is_read", false)
}
