/**
 * supabase/client.ts — Browser Supabase Client
 *
 * Returns null when Supabase is not configured (never throws).
 */
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/supabase"
import { isSupabaseConfigured } from "./config"

export type BrowserSupabaseClient = ReturnType<typeof createBrowserClient<Database>>

export function createClient(): BrowserSupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null
  }
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
