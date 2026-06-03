import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { JobAlert } from "@/types/alert"

export async function subscribeToAlerts(data: Partial<JobAlert>): Promise<{ success: boolean }> {
  if (!data.email) return { success: false }
  if (!isSupabaseConfigured()) return { success: true }
  const sb = await createClient()
  if (!sb) return { success: true }
  const { error } = await sb.from("job_alerts").insert({
    email: data.email,
    user_id: data.user_id ?? null,
    keywords: data.keywords ?? null,
    location: data.location ?? null,
    category: data.category ?? null,
    job_type: data.job_type ?? null,
    board: data.board ?? "all",
    frequency: data.frequency ?? "daily",
    is_active: true,
  })
  return { success: !error }
}

export async function getAlertsByEmail(email: string): Promise<JobAlert[]> {
  if (!isSupabaseConfigured()) return []
  const sb = await createClient()
  if (!sb) return []
  const { data } = await sb.from("job_alerts").select("*").eq("email", email).eq("is_active", true)
  return (data || []) as unknown as JobAlert[]
}

export async function deleteAlert(id: string) {
  if (!isSupabaseConfigured()) return { error: null }
  const sb = await createClient()
  if (!sb) return { error: null }
  return sb.from("job_alerts").update({ is_active: false }).eq("id", id)
}
