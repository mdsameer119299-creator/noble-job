/**
 * src/middleware.ts — Next.js Edge Middleware (must live next to src/app).
 *
 * Protected route matrix:
 *  /admin/*        → role = admin only (/admin/login is public)
 *  /employer/*     → role = employer only
 *  /candidate/*    → role = candidate only
 */

import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { isSupabaseConfigured } from "@/lib/supabase/config"

function isProtectedDashboardPath(path: string): boolean {
  if (path === "/admin/login") return false
  if (path.startsWith("/admin")) return true
  if (path.startsWith("/employer")) return true
  if (path.startsWith("/candidate")) return true
  return false
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname

  if (!isSupabaseConfigured() && isProtectedDashboardPath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.search = ""
    url.searchParams.set("reason", "config")
    url.searchParams.set("redirect", path)
    return NextResponse.redirect(url)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|fonts).*)",
  ],
}
