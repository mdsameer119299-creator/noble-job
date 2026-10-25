/**
 * supabase/server.ts — Server Supabase Client
 *
 * Returns null when Supabase is not configured (never throws).
 * Public pages and local-inventory fallbacks must handle null.
 */
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { ApplicationGateDatabase } from "@/types/applicationGateDatabase"
import { isSupabaseConfigured } from "./config"

export type ServerSupabaseClient = SupabaseClient<ApplicationGateDatabase>

export async function createClient(): Promise<ServerSupabaseClient | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  let cookieStore: Awaited<ReturnType<typeof cookies>>
  try {
    cookieStore = await cookies()
  } catch {
    // cookies() throws when called outside a request scope — e.g. while a
    // route/metadata file (such as /sitemap.xml, which sets `revalidate` and
    // is pre-rendered at build time) is being statically generated. There is
    // no real HTTP request to read a session from in that case, so this
    // mirrors the "not configured" branch above: callers already treat a
    // null client as "no session available" and fall back to their
    // cookie-less/local path (see jobService.ts's getJobs/getJobById) instead
    // of the build failing with DYNAMIC_SERVER_USAGE.
    return null
  }
  return createServerClient<ApplicationGateDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot set cookies (use app/auth/callback/route.ts for OAuth).
            // Middleware refreshes sessions on other routes.
          }
        },
      },
    }
  ) as unknown as ServerSupabaseClient
}

/** For API routes: null when Supabase is unavailable. */
export async function createClientForApi(): Promise<ServerSupabaseClient | null> {
  return createClient()
}
