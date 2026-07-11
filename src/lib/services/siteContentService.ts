import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/** Shape returned by the write helpers so callers can surface DB errors. */
type WriteResult = { error: { message: string } | null }

export async function getSiteContent(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {}
  const sb = await createClient()
  if (!sb) return {}
  const { data } = await sb.from("site_content").select("key, value")
  return Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

/**
 * Upsert a single site_content row. Uses the service-role client (consistent
 * with the rest of the admin write path) and UPSERT rather than UPDATE, so a
 * new key is inserted instead of silently matching zero rows. Returns the DB
 * error (if any) so the caller never reports success after a failed write.
 */
export async function updateSiteContent(key: string, value: string): Promise<WriteResult> {
  if (!isSupabaseConfigured()) return { error: { message: "Supabase is not configured" } }
  // updated_at is maintained by the DB trigger update_updated_at_column().
  const { error } = await supabaseAdmin
    .from("site_content")
    .upsert({ key, value }, { onConflict: "key" })
  return { error: error ? { message: error.message } : null }
}

export async function getAdminSettings(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {}
  const { data } = await supabaseAdmin.from("admin_settings").select("key, value")
  return Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

/**
 * Upsert a single admin_settings row. admin_settings is NOT seeded, so the old
 * UPDATE-by-key matched zero rows and settings never persisted — UPSERT fixes
 * that. Service-role client + returned error so failures surface to the caller.
 */
export async function updateAdminSetting(key: string, value: string): Promise<WriteResult> {
  if (!isSupabaseConfigured()) return { error: { message: "Supabase is not configured" } }
  // updated_at is maintained by the DB trigger update_updated_at_column().
  const { error } = await supabaseAdmin
    .from("admin_settings")
    .upsert({ key, value }, { onConflict: "key" })
  return { error: error ? { message: error.message } : null }
}
