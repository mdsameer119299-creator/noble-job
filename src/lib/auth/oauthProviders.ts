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

/**
 * Persist the chosen role in a short-lived, same-site cookie BEFORE the OAuth
 * redirect. The role also rides on the callback URL (?role=), but Supabase drops
 * that query param whenever it falls back to its configured Site URL — so the
 * query param alone is not reliable. This cookie survives the Google/LinkedIn
 * round-trip (SameSite=Lax is sent on the top-level GET navigation back to us),
 * guaranteeing a brand-new employer is provisioned as an employer, never a
 * candidate. The callback reads it (query param first, cookie fallback) and
 * clears it. NOTE: this only helps when the provider redirects back to THIS
 * domain — if Supabase's Site URL points elsewhere (e.g. localhost), fix it in
 * the Supabase dashboard (Authentication → URL Configuration).
 */
function rememberOAuthRole(role?: UserRole) {
  if (typeof document === "undefined" || !role) return
  document.cookie = `nj_oauth_role=${role}; Path=/; Max-Age=600; SameSite=Lax`
}

export async function signInWithGoogle(role: UserRole = "candidate") {
  const supabase = createClient()
  if (!supabase) return notConfigured()
  rememberOAuthRole(role)
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
  rememberOAuthRole(role)
  return supabase.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: { redirectTo: oauthRedirectUrl(role) },
  })
}
