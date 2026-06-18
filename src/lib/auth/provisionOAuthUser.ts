import { supabaseAdmin } from "@/lib/supabase/admin"
import type { User } from "@supabase/supabase-js"
import type { UserRole } from "./requireRole"

function isUserRole(v: unknown): v is UserRole {
  return v === "admin" || v === "employer" || v === "candidate"
}

/**
 * The role a NEW user is provisioned with, derived only from low-trust intent
 * signals (OAuth user_metadata + the ?role= callback query param). These may
 * ONLY ever request a non-privileged role: "admin" is never mintable from
 * intent — otherwise hitting /auth/callback?role=admin with a valid OAuth code
 * would self-escalate to admin. admin is assigned solely from an existing DB
 * row (the existing-role-wins branch in provisionOAuthUser).
 */
function isIntentRole(v: unknown): v is "employer" | "candidate" {
  return v === "employer" || v === "candidate"
}

function roleFromIntent(user: User, intentRole?: string | null): UserRole {
  const meta = user.user_metadata?.role as string | undefined
  if (isIntentRole(meta)) return meta
  if (isIntentRole(intentRole)) return intentRole
  return "candidate"
}

/**
 * Ensures OAuth sign-ins have a users row and a role-appropriate profile.
 *
 * `intentRole` is the role the user selected before the OAuth handshake (carried
 * on the callback URL). An existing user's stored role always wins so repeat
 * sign-ins never silently downgrade an employer to a candidate.
 */
export async function provisionOAuthUser(user: User, intentRole?: string | null): Promise<UserRole> {
  const { data: existingUser, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  const existingRole = (existingUser as { role?: string } | null)?.role

  // An existing DB role ALWAYS wins (employer/candidate/admin) — repeat sign-ins
  // never downgrade. Critically, if the lookup ERRORED we cannot prove the user
  // is new, so we must NOT write a role here: doing so could clobber an existing
  // employer/admin down to "candidate". Bail out, routing on best-known intent
  // only and leaving the stored role untouched.
  if (lookupError && !isUserRole(existingRole)) {
    return roleFromIntent(user, intentRole)
  }

  const role: UserRole = isUserRole(existingRole) ? existingRole : roleFromIntent(user, intentRole)
  const email = user.email ?? ""

  await supabaseAdmin.from("users").upsert(
    {
      id: user.id,
      email,
      role,
      status: "active",
      email_verified: Boolean(user.email_confirmed_at),
    },
    { onConflict: "id" }
  )

  if (role === "employer") {
    const { data: existing } = await supabaseAdmin
      .from("employers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      const name = (user.user_metadata?.full_name as string) || email.split("@")[0] || "Employer"
      await supabaseAdmin.from("employers").insert({
        user_id: user.id,
        company_name: name,
        city: "—",
        industry: "Other",
        company_size: "1-10",
        designation: "—",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    }
  } else if (role === "candidate") {
    const { data: existing } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      const full = (user.user_metadata?.full_name as string) || ""
      const parts = full.trim().split(/\s+/)
      const first = (user.user_metadata?.first_name as string) || parts[0] || "User"
      const last = (user.user_metadata?.last_name as string) || parts.slice(1).join(" ") || "—"
      await supabaseAdmin.from("candidates").insert({
        user_id: user.id,
        first_name: first,
        last_name: last,
        skills: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    }
  }

  return role
}
