import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { getUserProfile } from "@/lib/auth/getUserProfile"

export type AdminApiResult =
  | { user: User; error?: undefined }
  | { user?: undefined; error: NextResponse }

/**
 * Verifies the request has an authenticated Supabase session and users.role = 'admin'.
 * Returns 401 when unauthenticated, 403 when authenticated but not admin (or not active).
 */
export async function requireAdminApi(): Promise<AdminApiResult> {
  const api = await requireApiSupabase()
  if (api.error) return { error: api.error }

  const sb = api.sb
  const {
    data: { user },
  } = await sb.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const profile = await getUserProfile(sb, user.id)
  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  if (profile.status !== "active") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user }
}
