/**
 * authFailureService — persistent auth-failure audit + lockout policy.
 *
 * Writes to the service-role-only `auth_failures` table (see migration
 * 20260616000003). Used by the auth route to:
 *   - record failed logins / OTP verifications / password resets / rate-limit hits
 *   - enforce a durable lockout after repeated failures (survives process restarts,
 *     unlike the in-memory per-minute rate limiter)
 *
 * Lockout policy (per the approved plan):
 *   - login          : 10 failures / 30 minutes
 *   - otp_verify     : 5 failures  / 30 minutes
 *   - password_reset : 5 failures  / 30 minutes
 *
 * All functions are defensive: a logging/DB error must NEVER block or break the
 * auth flow, so failures here are swallowed (and surfaced via console).
 */
import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export type AuthFailureType =
  | "login"
  | "otp_verify"
  | "password_reset"
  | "rate_limit"
  | "lockout"

export interface AuthFailureMeta {
  email?: string | null
  userId?: string | null
  ip?: string | null
  userAgent?: string | null
}

const LOCKOUT_WINDOW_MS = 30 * 60 * 1000

const LOCKOUT_THRESHOLD: Partial<Record<AuthFailureType, number>> = {
  login: 10,
  otp_verify: 5,
  password_reset: 5,
}

/** Extract IP + user-agent from a request for audit purposes. */
export function authRequestMeta(req: Request): { ip: string; userAgent: string } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  const userAgent = req.headers.get("user-agent") || "unknown"
  return { ip, userAgent }
}

/** Record a single auth failure (fire-and-forget safe). */
export async function recordAuthFailure(
  type: AuthFailureType,
  meta: AuthFailureMeta = {},
  isLockout = false
): Promise<void> {
  // Always emit a structured server log, even if the DB write is unavailable.
  console.warn(
    `[auth-failure] type=${type} email=${meta.email ?? "-"} ip=${meta.ip ?? "-"} lockout=${isLockout}`
  )
  if (!isSupabaseConfigured()) return
  try {
    // auth_failures is not in the generated Database types yet; cast to keep this
    // service decoupled from the codegen step.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("auth_failures").insert({
      email: meta.email ?? null,
      user_id: meta.userId ?? null,
      ip: meta.ip ?? null,
      user_agent: meta.userAgent ?? null,
      failure_type: type,
      is_lockout: isLockout,
    })
  } catch (e) {
    console.warn("[auth-failure] insert failed:", e instanceof Error ? e.message : e)
  }
}

/**
 * True when `email` has reached the failure threshold for `type` within the
 * lockout window. Counts only failures of the same type (login vs otp_verify vs
 * password_reset). Returns false on any error so auth is never wrongly blocked.
 */
export async function isLockedOut(email: string, type: AuthFailureType): Promise<boolean> {
  const threshold = LOCKOUT_THRESHOLD[type]
  if (!threshold || !email || !isSupabaseConfigured()) return false
  try {
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabaseAdmin as any)
      .from("auth_failures")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("failure_type", type)
      .gt("created_at", since)
    if (error) return false
    return (count || 0) >= threshold
  } catch {
    return false
  }
}

/** Lockout window in minutes — for user-facing "try again later" messaging. */
export const LOCKOUT_WINDOW_MINUTES = LOCKOUT_WINDOW_MS / 60000
