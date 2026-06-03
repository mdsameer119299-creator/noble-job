import { create } from "zustand"
import type { Notification } from "@/types/notification"
interface NotificationStoreState {
  notifications: Notification[]; unreadCount: number
  setNotifications: (n: Notification[]) => void
  markRead: (id: string) => void; clearAll: () => void
}
export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [], unreadCount: 0,
  setNotifications: (notifications) => set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length }),
  markRead: (id) => set(s => {
    const updated = s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
    return { notifications: updated, unreadCount: updated.filter(n => !n.is_read).length }
  }),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))
