import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/supabase"
import { isSupabaseConfigured } from "./config"
import { getUserProfile } from "@/lib/auth/getUserProfile"
import type { UserRole } from "@/lib/auth/requireRole"

const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  employer: "/employer/dashboard",
  candidate: "/candidate/dashboard",
}

function nextWithPathname(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

function redirectToAuth(request: NextRequest, reason: string, redirectPath?: string) {
  const url = request.nextUrl.clone()
  url.pathname = "/auth"
  url.search = ""
  url.searchParams.set("reason", reason)
  if (redirectPath) url.searchParams.set("redirect", redirectPath)
  return NextResponse.redirect(url)
}

function isProtectedDashboardPath(path: string): boolean {
  const isAdminLogin = path === "/admin/login"
  const isAdminRoute = path.startsWith("/admin") && !isAdminLogin
  return isAdminRoute || path.startsWith("/employer") || path.startsWith("/candidate")
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname

  if (!isSupabaseConfigured()) {
    if (isProtectedDashboardPath(path)) {
      return redirectToAuth(request, "config", path)
    }
    return nextWithPathname(request)
  }

  const supabaseResponse = nextWithPathname(request)

  try {
    return await runSessionChecks(request, supabaseResponse)
  } catch {
    return supabaseResponse
  }
}

async function runSessionChecks(
  request: NextRequest,
  initialResponse: NextResponse
): Promise<NextResponse> {
  let supabaseResponse = initialResponse

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const requestHeaders = new Headers(request.headers)
          requestHeaders.set("x-pathname", request.nextUrl.pathname)
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isAdminLogin = path === "/admin/login"
  const isAdminRoute = path.startsWith("/admin") && !isAdminLogin
  const isEmployerRoute = path.startsWith("/employer")
  const isCandidateRoute = path.startsWith("/candidate")
  const isProtectedDashboard = isAdminRoute || isEmployerRoute || isCandidateRoute
  const isAuthRoute = path === "/auth" || path.startsWith("/auth/")

  if (!user) {
    if (isProtectedDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth"
      url.searchParams.set("redirect", path)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const profile = await getUserProfile(supabase, user.id)

  if (isAuthRoute && path !== "/auth/callback") {
    if (profile?.status === "active" && profile.role in DASHBOARD_BY_ROLE) {
      const url = request.nextUrl.clone()
      url.pathname = DASHBOARD_BY_ROLE[profile.role as UserRole]
      url.search = ""
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  if (isAdminRoute && profile?.role !== "admin") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.searchParams.set("reason", "unauthorized")
    return NextResponse.redirect(url)
  }

  if (isEmployerRoute && profile?.role !== "employer") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.searchParams.set("reason", "unauthorized")
    return NextResponse.redirect(url)
  }

  if (isCandidateRoute && profile?.role !== "candidate") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.searchParams.set("reason", "unauthorized")
    return NextResponse.redirect(url)
  }

  if (isProtectedDashboard && profile?.status === "pending") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.searchParams.set("reason", "verify-email")
    return NextResponse.redirect(url)
  }

  if (isProtectedDashboard && profile?.status !== "active") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.searchParams.set("reason", "suspended")
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
