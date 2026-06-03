"use client"
import { useAuthStore } from "@/store/authStore"
import { useAdminStore } from "@/store/adminStore"

export function useAdmin() {
  const user = useAuthStore(s => s.user)
  const { stats, activeSection, setSection } = useAdminStore()
  return { user, stats, activeSection, setSection, isAdmin: user?.role === "admin" }
}
