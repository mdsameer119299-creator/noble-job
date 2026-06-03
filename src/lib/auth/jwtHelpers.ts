// JWT helpers — Supabase handles JWT internally.
// These helpers are for extracting custom claims if needed.

export function getRoleFromJwt(jwt: string): string | null {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]))
    return payload.role || null
  } catch { return null }
}
