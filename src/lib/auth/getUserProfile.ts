import type { UserRole } from "./requireRole"

export type UserProfile = {
  role: UserRole
  status: string
  email_verified: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserProfile(supabase: any, userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("users")
    .select("role, status, email_verified")
    .eq("id", userId)
    .single()

  if (!data?.role) return null
  return {
    role: data.role as UserRole,
    status: data.status,
    email_verified: Boolean(data.email_verified),
  }
}
