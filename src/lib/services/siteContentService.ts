import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export async function getSiteContent(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {}
  const sb = await createClient()
  if (!sb) return {}
  const { data } = await sb.from("site_content").select("key, value")
  return Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

export async function updateSiteContent(key: string, value: string) {
  if (!isSupabaseConfigured()) return { error: { message: "not configured" } }
  const sb = await createClient()
  if (!sb) return { error: { message: "not configured" } }
  return sb.from("site_content").update({ value }).eq("key", key)
}

export async function getAdminSettings(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {}
  const sb = await createClient()
  if (!sb) return {}
  const { data } = await sb.from("admin_settings").select("key, value")
  return Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

export async function updateAdminSetting(key: string, value: string) {
  if (!isSupabaseConfigured()) return { error: { message: "not configured" } }
  const sb = await createClient()
  if (!sb) return { error: { message: "not configured" } }
  return sb.from("admin_settings").update({ value }).eq("key", key)
}
