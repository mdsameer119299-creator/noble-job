"use client"
import { useState, useEffect, useCallback } from "react"
import type { Notification } from "@/types/notification"

export function useNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch("/api/notifications")
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setItems(d.data || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" })
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const unread = items.filter(n => !n.is_read).length

  return { items, loading, unread, refresh, markRead }
}
