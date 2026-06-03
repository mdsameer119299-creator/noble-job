/**
 * supabase/realtime.ts — Real-time subscription helpers
 *
 * Returns no-op unsubscribe when Supabase is not configured.
 */
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

type NoopChannel = { unsubscribe: () => void }

const noopChannel: NoopChannel = { unsubscribe: () => {} }

export type RealtimeChannel = NoopChannel | ReturnType<NonNullable<ReturnType<typeof createClient>>["channel"]>

export function subscribeToMessages(
  userId: string,
  callback: (payload: unknown) => void
): RealtimeChannel {
  if (!isSupabaseConfigured()) return noopChannel
  const supabase = createClient()
  if (!supabase) return noopChannel
  return supabase
    .channel(`messages:${userId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `recipient_id=eq.${userId}`,
    }, callback)
    .subscribe()
}

export function subscribeToNotifications(
  userId: string,
  callback: (payload: unknown) => void
): RealtimeChannel {
  if (!isSupabaseConfigured()) return noopChannel
  const supabase = createClient()
  if (!supabase) return noopChannel
  return supabase
    .channel(`notifications:${userId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    }, callback)
    .subscribe()
}
