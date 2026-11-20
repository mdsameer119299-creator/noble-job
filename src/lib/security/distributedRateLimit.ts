/**
 * distributedRateLimit.ts — abuse protection that works across serverless
 * instances without any paid service or schema change.
 *
 * State lives in the EXISTING service-role-only `auth_failures` table
 * (failure_type = 'rate_limit', user_agent = 'ratelimit:<scope>'), the same
 * durable store the auth lockout policy already uses. Client identity is an
 * HMAC of the IP (never the raw IP), so no personal data is persisted.
 *
 * If the database is unreachable the limiter DEGRADES to the in-process
 * limiter (best-effort per instance) instead of blocking legitimate users.
 */
import { createHmac } from "node:crypto"
import { rateLimit as memoryRateLimit } from "@/lib/utils/rateLimit"

export interface RateLimitPolicy {
  /** Logical bucket, e.g. "resume-quick-score". */
  scope: string
  perClient: { max: number; windowMs: number }
  /** Ceiling across ALL clients (protects against distributed abuse). */
  global: { max: number; windowMs: number }
}

export interface RateLimitBackend {
  /** Hits for this scope in the window; `clientKey` null counts every client. */
  count(scope: string, clientKey: string | null, windowMs: number): Promise<number>
  record(scope: string, clientKey: string): Promise<void>
}

export type RateLimitDecision =
  | { allowed: true; degraded: boolean }
  | { allowed: false; retryAfterSec: number; reason: "client" | "global" }

const UA_PREFIX = "ratelimit:"

/** Stable pseudonymous client id. Raw IPs are never stored. */
export function clientKeyFromRequest(req: Request, secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "noble-job-rl"): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32)
}

export const supabaseRateLimitBackend: RateLimitBackend = {
  async count(scope, clientKey, windowMs) {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const since = new Date(Date.now() - windowMs).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabaseAdmin as any)
      .from("auth_failures")
      .select("id", { count: "exact", head: true })
      .eq("failure_type", "rate_limit")
      .eq("user_agent", UA_PREFIX + scope)
      .gt("created_at", since)
    if (clientKey) q = q.eq("ip", clientKey)
    const { count, error } = await q
    if (error) throw new Error("rate-limit-count-failed")
    return count || 0
  },
  async record(scope, clientKey) {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("auth_failures").insert({
      ip: clientKey,
      user_agent: UA_PREFIX + scope,
      failure_type: "rate_limit",
      is_lockout: false,
    })
    if (error) throw new Error("rate-limit-record-failed")
    // Opportunistic cleanup of OUR OWN rows only (>1 day old) so the audit table cannot grow unbounded.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from("auth_failures")
        .delete()
        .eq("failure_type", "rate_limit")
        .like("user_agent", UA_PREFIX + "%")
        .lt("created_at", cutoff)
    }
  },
}

let backend: RateLimitBackend = supabaseRateLimitBackend
/** Test seam. */
export function setRateLimitBackend(b: RateLimitBackend | null) {
  backend = b ?? supabaseRateLimitBackend
}

export async function checkRateLimit(req: Request, policy: RateLimitPolicy): Promise<RateLimitDecision> {
  const clientKey = clientKeyFromRequest(req)
  try {
    const [mine, all] = await Promise.all([
      backend.count(policy.scope, clientKey, policy.perClient.windowMs),
      backend.count(policy.scope, null, policy.global.windowMs),
    ])
    if (mine >= policy.perClient.max) {
      return { allowed: false, reason: "client", retryAfterSec: Math.ceil(policy.perClient.windowMs / 1000) }
    }
    if (all >= policy.global.max) {
      return { allowed: false, reason: "global", retryAfterSec: Math.ceil(policy.global.windowMs / 1000) }
    }
    await backend.record(policy.scope, clientKey)
    return { allowed: true, degraded: false }
  } catch {
    // Store unavailable: fall back to per-instance limiting rather than failing open entirely.
    const r = memoryRateLimit(`${policy.scope}:${clientKey}`, policy.perClient.max, policy.perClient.windowMs)
    if (!r.success) {
      return { allowed: false, reason: "client", retryAfterSec: Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000)) }
    }
    return { allowed: true, degraded: true }
  }
}
