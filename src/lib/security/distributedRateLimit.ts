/**
 * distributedRateLimit.ts — abuse protection that works across serverless
 * instances without any paid service or schema change.
 *
 * STORAGE
 *   Rows in the EXISTING service-role-only `auth_failures` table
 *   (failure_type = 'rate_limit', RLS on, no public policy). Nothing else reads
 *   `auth_failures` except authFailureService, which filters by `email` +
 *   failure_type IN (login, otp_verify, password_reset), so these rows cannot
 *   affect login / OTP / password-reset lockouts.
 *   Our rows are identified by an unforgeable tag stored in `email`
 *   ("rl:" + HMAC(secret, scope)). The auth route also writes failure_type
 *   'rate_limit' rows with attacker-controlled user-agent/email, so a plain
 *   user-agent match would let an attacker inflate our counters or have their own
 *   audit rows swept by our cleanup. The tag cannot be forged without the secret.
 *
 * CONCURRENCY
 *   Record-then-count, not count-then-record: each request INSERTS its own hit
 *   first, then counts (own row included) and is allowed only if count <= max.
 *   For any burst, at most `max` requests can see a count <= max (the (max+1)th
 *   committed insert always sees >= max+1 rows), so parallel requests cannot
 *   exceed the limit. A denied request deletes its own row so rejected traffic
 *   does not consume the global budget or grow the table.
 *
 * FAILURE MODES (documented, deliberate)
 *   Every database call is given DB_DEADLINE_MS to answer. The deadline only makes THIS REQUEST
 *   STOP WAITING — it does NOT cancel the underlying Supabase operation, which may still finish
 *   later. If the store is unreachable/slow the request is NOT blocked; it is allowed under a
 *   per-instance in-memory limit only (`degraded: true`). Availability of the free resume scorer
 *   is preferred over hard-failing while the DB is down; abuse is still bounded by the
 *   byte/page/time caps and the per-instance limiter.
 *
 * LATE OPERATIONS (what happens to work that finishes after the deadline)
 *   - Late INSERT: the in-process promise keeps running; when it finally resolves with a row id
 *     the row is withdrawn immediately ("abandoned" flag), so it cannot sit in the counters. If the
 *     process is frozen/terminated before that (serverless), the row stays; it counts only against
 *     this client's own window (it over-counts, never under-counts) and is swept after 24 h.
 *   - Late/failed DELETE (withdrawal): the row id goes to a small bounded in-process retry queue
 *     (ORPHAN_QUEUE_MAX) that later requests drain; if that is lost too, the same over-count bound applies.
 *   - Late COUNT: read-only, ignored.
 *
 * LOAD / GROWTH
 *   Allowed request = 1 insert + 2 head-counts; denied = +1 delete (and a repeat
 *   offender is stopped by the in-instance pre-gate before touching the DB).
 *   Retained rows are bounded by the global ceiling per window; a 2% opportunistic
 *   sweep removes only OUR tagged rows older than 24h.
 *
 * PRIVACY
 *   Client id = HMAC(subkey, ip) truncated to 128 bits; raw IPs are never stored.
 *   subkey = HMAC(SUPABASE_SERVICE_ROLE_KEY, domain label). With no secret
 *   available (the DB could not be reached anyway) a random per-process key is used
 *   — never a constant that would make IPv4 hashes brute-forceable.
 */
import { createHmac, randomBytes } from "node:crypto"
import { rateLimit as memoryRateLimit } from "@/lib/utils/rateLimit"
import { getTrustedClientIp } from "@/lib/security/clientIp"

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
  /** Insert one hit and return its id so a denied request can withdraw it. */
  record(scope: string, clientKey: string): Promise<string>
  /** Withdraw a hit recorded by this request (best effort). */
  remove(scope: string, id: string): Promise<void>
}

export type RateLimitDecision =
  | { allowed: true; degraded: boolean }
  | { allowed: false; retryAfterSec: number; reason: "client" | "global" }

const UA_PREFIX = "ratelimit:"
/** How long a request WAITS for any single rate-limit DB call before degrading (it does not cancel the call). */
export const DB_DEADLINE_MS = 2500
const SWEEP_PROBABILITY = 0.02
const SWEEP_AGE_MS = 24 * 3600_000

const processSecret = randomBytes(32).toString("hex")
function subKey(): string {
  const root = process.env.SUPABASE_SERVICE_ROLE_KEY || processSecret
  return createHmac("sha256", root).update("noble-job/rate-limit/v1").digest("hex")
}

/** Unforgeable marker stored in `email` on OUR rows (see header). */
export function scopeTag(scope: string): string {
  return "rl:" + createHmac("sha256", subKey()).update("scope:" + scope).digest("hex").slice(0, 32)
}

/** Stable pseudonymous client id. Raw IPs are never stored. */
export function clientKeyFromRequest(req: Request): string {
  const ip = getTrustedClientIp(req) // see clientIp.ts for the trust model
  return createHmac("sha256", subKey()).update("ip:" + ip).digest("hex").slice(0, 32)
}

let deadlineMs = DB_DEADLINE_MS
/** Test seam: shorten the deadline so late-completion paths can be exercised quickly. */
export function setRateLimitDeadlineMs(ms: number | null) { deadlineMs = ms ?? DB_DEADLINE_MS }

/** Stop WAITING after `ms`. Does not cancel `p`; late settlement is swallowed (no unhandled rejection). */
function withDeadline<T>(p: PromiseLike<T>, ms = deadlineMs): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("rate-limit-timeout")), ms)
    Promise.resolve(p).then(
      v => { clearTimeout(t); resolve(v) },
      e => { clearTimeout(t); reject(e) },
    )
  })
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
      .eq("email", scopeTag(scope))
      .gt("created_at", since)
    if (clientKey) q = q.eq("ip", clientKey)
    const { count, error } = await q
    if (error) throw new Error("rate-limit-count-failed")
    return count || 0
  },
  async record(scope, clientKey) {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("auth_failures")
      .insert({
        email: scopeTag(scope),
        ip: clientKey,
        user_agent: UA_PREFIX + scope,
        failure_type: "rate_limit",
        is_lockout: false,
      })
      .select("id")
      .single()
    if (error || !data) throw new Error("rate-limit-record-failed")
    if (Math.random() < SWEEP_PROBABILITY) {
      try {
        const cutoff = new Date(Date.now() - SWEEP_AGE_MS).toISOString()
        // OUR rows only: failure_type + unforgeable tag. Never touches login/otp/reset/lockout rows.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await withDeadline((supabaseAdmin as any)
          .from("auth_failures")
          .delete()
          .eq("failure_type", "rate_limit")
          .eq("email", scopeTag(scope))
          .lt("created_at", cutoff))
      } catch { /* sweep is best effort */ }
    }
    return String(data.id)
  },
  async remove(scope, id) {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("auth_failures")
      .delete()
      .eq("id", id)
      .eq("failure_type", "rate_limit")
      .eq("email", scopeTag(scope))
  },
}

let backend: RateLimitBackend = supabaseRateLimitBackend
/** Test seam. */
export function setRateLimitBackend(b: RateLimitBackend | null) {
  backend = b ?? supabaseRateLimitBackend
}

/** Rows whose withdrawal failed or timed out; retried (bounded) by later requests. */
const ORPHAN_QUEUE_MAX = 200
const orphans: { scope: string; id: string }[] = []
export function __orphanCount() { return orphans.length }
function queueOrphan(scope: string, id: string) {
  if (orphans.length >= ORPHAN_QUEUE_MAX) orphans.shift()
  orphans.push({ scope, id })
}
function drainOrphans() {
  for (const o of orphans.splice(0, 3)) {
    // fire-and-forget; on failure it goes back in the queue
    withDeadline(backend.remove(o.scope, o.id)).catch(() => queueOrphan(o.scope, o.id))
  }
}

export async function checkRateLimit(req: Request, policy: RateLimitPolicy): Promise<RateLimitDecision> {
  const clientKey = clientKeyFromRequest(req)

  // In-instance pre-gate. It only sees a subset of this client's traffic, so it can never
  // deny a client the shared store would allow; it just spares the DB from repeat offenders
  // and is also the per-instance limiter used when the store is down.
  const pre = memoryRateLimit(`rlpre:${policy.scope}:${clientKey}`, policy.perClient.max, policy.perClient.windowMs)
  if (!pre.success) {
    return { allowed: false, reason: "client", retryAfterSec: Math.max(1, Math.ceil((pre.resetAt - Date.now()) / 1000)) }
  }

  if (orphans.length) drainOrphans()

  // The insert may outlive our deadline; if it does, withdraw it as soon as it lands.
  let abandoned = false
  const inserting = Promise.resolve(backend.record(policy.scope, clientKey))
  inserting.then(
    lateId => { if (abandoned) withDeadline(backend.remove(policy.scope, lateId)).catch(() => queueOrphan(policy.scope, lateId)) },
    () => { /* insert failed: nothing to withdraw */ },
  )

  let id: string
  try {
    id = await withDeadline(inserting)
  } catch {
    abandoned = true // late success (if any) is withdrawn by the handler above
    return { allowed: true, degraded: true } // store unavailable: per-instance gate already applied
  }

  const withdraw = async () => {
    try { await withDeadline(backend.remove(policy.scope, id)) } catch { queueOrphan(policy.scope, id) }
  }

  let mine: number
  let all: number
  try {
    ;[mine, all] = await withDeadline(Promise.all([
      backend.count(policy.scope, clientKey, policy.perClient.windowMs),
      backend.count(policy.scope, null, policy.global.windowMs),
    ]))
  } catch {
    await withdraw()
    return { allowed: true, degraded: true }
  }

  // Counts include this request's own row, so the limit is "<= max".
  if (mine > policy.perClient.max) {
    await withdraw()
    return { allowed: false, reason: "client", retryAfterSec: Math.ceil(policy.perClient.windowMs / 1000) }
  }
  if (all > policy.global.max) {
    await withdraw()
    return { allowed: false, reason: "global", retryAfterSec: Math.ceil(policy.global.windowMs / 1000) }
  }
  return { allowed: true, degraded: false }
}
