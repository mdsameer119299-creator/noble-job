import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { AUTH_UNAVAILABLE_MESSAGE } from "@/lib/supabase/guards"
import type { UserRole } from "@/lib/auth/requireRole"

// Carry the chosen role through to the callback. signInWithOAuth cannot set
// user_metadata, so role intent rides on the redirect URL; the callback reads it
// and provisions the correct role (otherwise every OAuth user became a candidate).
function oauthRedirectUrl(role?: UserRole): string {
  const path = role ? `/auth/callback?role=${role}` : "/auth/callback"
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  return base ? `${base}${path}` : `http://localhost:3000${path}`
}

function notConfigured() {
  return { data: null, error: { message: AUTH_UNAVAILABLE_MESSAGE } as { message: string } }
}

export async function signInWithGoogle(role: UserRole = "candidate") {
  const supabase = createClient()
  if (!supabase) return notConfigured()
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthRedirectUrl(role),
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  })
}

export async function signInWithLinkedIn(role: UserRole = "candidate") {
  const supabase = createClient()
  if (!supabase) return notConfigured()
  return supabase.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: { redirectTo: oauthRedirectUrl(role) },
  })
}
