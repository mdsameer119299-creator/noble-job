"use client"
import { useAuthStore } from "@/store/authStore"
import { useEmployerStore } from "@/store/employerStore"

export function useEmployer() {
  const user = useAuthStore(s => s.user)
  const { stats, activeSection, setSection } = useEmployerStore()
  return { user, stats, activeSection, setSection, isEmployer: user?.role === "employer" }
}
