/**
 * hooks/useAuth.ts — Authentication hook
 *
 * Provides auth state, login, logout, and session management
 * for Client Components. Syncs with Supabase session changes.
 *
 * Returns:
 *   user        — current AuthUser or null
 *   isLoading   — true during session check
 *   isAdmin     — role check boolean
 *   isEmployer  — role check boolean
 *   isCandidate — role check boolean
 *   login()     — signInWithPassword
 *   loginWithGoogle() — OAuth
 *   loginWithLinkedIn() — OAuth
 *   logout()    — signOut + clear store
 */

"use client"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuthStore }  from "@/store/authStore"

export function useAuth() {
  const { user, isLoading, setUser, clearUser } = useAuthStore()
  // Implementation goes here in Step 5
  return {
    user,
    isLoading,
    isAdmin:     user?.role === "admin",
    isEmployer:  user?.role === "employer",
    isCandidate: user?.role === "candidate",
  }
}
