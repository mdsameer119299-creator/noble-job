"use client"
import { useAuthStore } from "@/store/authStore"
import { useCandidateStore } from "@/store/candidateStore"

export function useCandidate() {
  const user = useAuthStore(s => s.user)
  const { profile, profileScore, activeSection, setSection } = useCandidateStore()
  return { user, profile, profileScore, activeSection, setSection, isCandidate: user?.role === "candidate" }
}
