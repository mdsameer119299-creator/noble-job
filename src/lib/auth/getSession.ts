import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export async function getSession() {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, role, status")
    .eq("id", user.id)
    .single()

  return profile
}
