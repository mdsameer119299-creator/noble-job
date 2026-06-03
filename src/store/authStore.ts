/**
 * store/authStore.ts — Global auth state (Zustand)
 *
 * Stores the currently authenticated user across Client Components.
 * Synced with Supabase session via useAuth hook.
 *
 * State:
 *   user     — current user object (id, email, role, status)
 *   isLoading — true during initial session check
 *   isAdmin / isEmployer / isCandidate — computed role booleans
 *
 * Actions:
 *   setUser(user)  — called when session is established
 *   clearUser()    — called on logout
 */

import { create } from "zustand"

export interface AuthUser {
  id:     string
  email:  string
  role:   "admin" | "employer" | "candidate"
  status: "active" | "suspended"
}

interface AuthState {
  user:        AuthUser | null
  isLoading:   boolean
  setUser:     (user: AuthUser | null) => void
  clearUser:   () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  isLoading: true,
  setUser:   (user) => set({ user, isLoading: false }),
  clearUser: ()     => set({ user: null, isLoading: false }),
}))

// Computed selectors
export const selectIsAdmin     = (s: AuthState) => s.user?.role === "admin"
export const selectIsEmployer  = (s: AuthState) => s.user?.role === "employer"
export const selectIsCandidate = (s: AuthState) => s.user?.role === "candidate"
