/**
 * supabase/server.ts — Server Supabase Client
 *
 * Returns null when Supabase is not configured (never throws).
 * Public pages and local-inventory fallbacks must handle null.
 */
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"
import { isSupabaseConfigured } from "./config"

export type ServerSupabaseClient = SupabaseClient<Database>

export async function createClient(): Promise<ServerSupabaseClient | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  const cookieStore = await cookies()
  return createServerClient<Database>(
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
