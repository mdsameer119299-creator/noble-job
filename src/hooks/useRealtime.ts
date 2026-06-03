/**
 * hooks/useRealtime.ts — Supabase Realtime subscription hook
 *
 * Manages real-time channel subscriptions for:
 *   - New messages (MessagesTab)
 *   - New notifications (NotificationBell)
 *   - Live pending job count (Admin dashboard badge)
 *
 * Automatically unsubscribes on component unmount.
 */

"use client"
import { useEffect, useRef } from "react"
import {
  subscribeToMessages,
  subscribeToNotifications,
  type RealtimeChannel,
} from "@/lib/supabase/realtime"

export function useMessageSubscription(
  userId: string,
  onMessage: (payload: unknown) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  useEffect(() => {
    channelRef.current = subscribeToMessages(userId, onMessage)
    return () => { channelRef.current?.unsubscribe() }
  }, [userId])
}
