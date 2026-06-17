/**
 * Resolve where to send a user after login.
 *
 * Honors an intended `redirect` (e.g. "Post a Job" → /employer/jobs/new) ONLY when
 * it is safe for the user's role, otherwise falls back to the role's dashboard.
 * This guarantees no cross-role redirect is ever possible:
 *   - /employer/*  → only for role 'employer'
 *   - /candidate/* → only for role 'candidate'
 *   - /admin/*     → only for role 'admin'
 *   - neutral app paths (e.g. /jobs/*) → allowed for any role
 *   - /auth* or off-site/invalid → ignored (use dashboard)
 */
const DASHBOARD: Record<string, string> = {
  employer: "/employer/dashboard",
  candidate: "/candidate/dashboard",
  admin: "/admin/dashboard",
}

export function resolvePostLoginPath(role: string | undefined, redirect: string | null): string {
  const dash = DASHBOARD[role ?? ""] ?? "/candidate/dashboard"

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return dash
  if (redirect.startsWith("/auth")) return dash

  // Role-scoped areas: only honor when the redirect matches the user's role.
  if (redirect.startsWith("/employer")) return role === "employer" ? redirect : dash
  if (redirect.startsWith("/candidate")) return role === "candidate" ? redirect : dash
  if (redirect.startsWith("/admin")) return role === "admin" ? redirect : dash

  // Neutral path (jobs, contact, etc.) — safe for any role.
  return redirect
}
