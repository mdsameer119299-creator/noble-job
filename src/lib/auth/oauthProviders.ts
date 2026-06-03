import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { AUTH_UNAVAILABLE_MESSAGE } from "@/lib/supabase/guards"

function oauthRedirectUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  return base ? `${base}/auth/callback` : "http://localhost:3000/auth/callback"
}

function notConfigured() {
  return { data: null, error: { message: AUTH_UNAVAILABLE_MESSAGE } as { message: string } }
}

export async function signInWithGoogle() {
  const supabase = createClient()
  if (!supabase) return notConfigured()
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthRedirectUrl(),
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  })
}

export async function signInWithLinkedIn() {
  const supabase = createClient()
  if (!supabase) return notConfigured()
  return supabase.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: { redirectTo: oauthRedirectUrl() },
  })
}
