/**
 * supabase/public.ts — Cookie-less, anonymous server Supabase client.
 *
 * For public, user-independent reads on statically generated / ISR pages
 * (landing pages, sitemap inputs, counts). Unlike `server.ts#createClient`,
 * it never calls `cookies()`, so it cannot flip an ISR page to dynamic at
 * runtime ("Page changed from static to dynamic at runtime ... reason: cookies").
 *
 * Security: uses the public ANON key only — Row Level Security applies exactly
 * as it does for a signed-out visitor. It never carries a user session and
 * never uses the service-role key.
 *
 * Returns null when Supabase is not configured (same contract as server.ts).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ApplicationGateDatabase } from "@/types/applicationGateDatabase"
import { isSupabaseConfigured } from "./config"

export type PublicSupabaseClient = SupabaseClient<ApplicationGateDatabase>

let cached: PublicSupabaseClient | null = null

export function createPublicClient(): PublicSupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (cached) return cached
  cached = createSupabaseClient<ApplicationGateDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )
  return cached
}
