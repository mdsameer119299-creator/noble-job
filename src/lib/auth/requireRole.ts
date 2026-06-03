import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getUserProfile } from "@/lib/auth/getUserProfile"
import { redirect } from "next/navigation"

export type UserRole = "admin" | "employer" | "candidate"

export async function requireRole(role: UserRole) {
  if (!isSupabaseConfigured()) {
    redirect("/auth?reason=config")
  }

  const supabase = await createClient()
  if (!supabase) {
    redirect("/auth?reason=config")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth?reason=unauthenticated")

  const profile = await getUserProfile(supabase, user.id)

  if (!profile || profile.role !== role) {
    redirect("/auth?reason=unauthorized")
  }

  if (profile.status === "pending") {
    redirect("/auth?reason=verify-email")
  }

  if (profile.status !== "active") {
    redirect("/auth?reason=suspended")
  }

  return { user, role: profile.role }
}
