/**
 * supabase/admin.ts — Supabase Admin Client (Service Role)
 *
 * Bypasses Row Level Security (RLS). Used ONLY in:
 *  - Server-only admin API routes (/api/admin/*)
 *  - Background cron services (Himalayas cache, email queue)
 *  - Database seeding scripts
 *
 * NEVER import this in Client Components.
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Fall back to valid-looking placeholders so importing this module never throws
// when env vars are missing (e.g. local dev without a DB). Callers must guard
// real usage with isSupabaseConfigured(); the placeholder client is never queried.
// .trim() defends against a very common deploy mistake: a secret pasted with a
// trailing newline/space (CI secret managers often add one), which makes the
// apikey header invalid and yields Supabase "Invalid API key" at query time.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://placeholder.supabase.co"
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "placeholder-service-role-key"

export const supabaseAdmin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
