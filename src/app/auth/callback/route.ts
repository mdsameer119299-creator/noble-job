/**
 * OAuth callback Route Handler — exchangeCodeForSession must set cookies on the
 * outgoing NextResponse.redirect (Server Component page.tsx cannot do this).
 */
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { provisionOAuthUser } from "@/lib/auth/provisionOAuthUser"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { Database } from "@/types/supabase"
import type { UserRole } from "@/lib/auth/requireRole"

const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  employer: "/employer/dashboard",
  candidate: "/candidate/dashboard",
}

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/auth?reason=config", requestUrl))
  }

  const oauthError = requestUrl.searchParams.get("error")
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/auth?reason=oauth&error=${encodeURIComponent(oauthError)}`, requestUrl)
    )
  }

  const code = requestUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(new URL("/auth", requestUrl))
  }

  const cookieStore = await cookies()
  const sessionCookies: CookieToSet[] = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach((cookie) => {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
            sessionCookies.push(cookie)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?reason=oauth&error=${encodeURIComponent(error.message)}`, requestUrl)
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/auth", requestUrl))
  }

  // Role intent: prefer the callback query param, fall back to the cookie set
  // before the redirect (oauthProviders.rememberOAuthRole). The cookie covers the
  // case where Supabase strips ?role= on a Site-URL fallback, so a brand-new
  // employer is never provisioned as a candidate.
  const intentRole = requestUrl.searchParams.get("role") || cookieStore.get("nj_oauth_role")?.value || null
  const role = await provisionOAuthUser(user, intentRole)
  const dest = DASHBOARD_BY_ROLE[role] ?? DASHBOARD_BY_ROLE.candidate

  const response = NextResponse.redirect(new URL(dest, requestUrl))
  sessionCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  // One-time intent cookie — clear it now that the role is resolved.
  response.cookies.set("nj_oauth_role", "", { path: "/", maxAge: 0 })

  return response
}
