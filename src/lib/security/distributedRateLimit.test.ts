/**
 * distributedRateLimit.test.ts — race safety, failure modes, row tagging and key hygiene
 * of the cross-instance limiter. Synthetic data only; no network, no database.
 *   npm run test:rate-limit
 */
import assert from "node:assert/strict"
import {
  checkRateLimit, setRateLimitBackend, clientKeyFromRequest, scopeTag, DB_DEADLINE_MS,
  setRateLimitDeadlineMs, __orphanCount,
  type RateLimitBackend, type RateLimitPolicy,
} from "./distributedRateLimit"
import { getTrustedClientIp } from "./clientIp"
import {
  rateLimit, RATE_LIMIT_MAX_KEYS, RATE_LIMIT_SWEEP_INTERVAL_MS, __rateLimitStoreSize, __rateLimitReset,
} from "@/lib/utils/rateLimit"

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; process.stdout.write(`  PASS  ${name}\n`) }
  catch (e) { failed++; process.stderr.write(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}\n`) }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const req = (ip: string) => new Request("http://localhost/x", { headers: { "x-forwarded-for": ip } })

/** Backend with random latency so concurrent requests interleave like separate serverless instances. */
function slowBackend() {
  const rows: { id: number; scope: string; key: string; at: number; live: boolean }[] = []
  let n = 0
  const jitter = () => sleep(Math.random() * 15)
  const b: RateLimitBackend & { rows: typeof rows; live: () => number } = {
    rows,
    live: () => rows.filter(r => r.live).length,
    async record(scope, key) { await jitter(); const id = ++n; rows.push({ id, scope, key, at: Date.now(), live: true }); return String(id) },
    async count(scope, key, windowMs) {
      await jitter()
      const since = Date.now() - windowMs
      return rows.filter(r => r.live && r.scope === scope && r.at > since && (key === null || r.key === key)).length
    },
    async remove(_s, id) { await jitter(); const r = rows.find(x => String(x.id) === id); if (r) r.live = false },
  }
  return b
}

async function main() {
  const policy = (scope: string, globalMax: number): RateLimitPolicy => ({
    scope, perClient: { max: 5, windowMs: 600_000 }, global: { max: globalMax, windowMs: 3_600_000 },
  })

  await test("RACE: 60 simultaneous requests from 60 clients never exceed the global ceiling", async () => {
    for (const trial of [1, 2, 3]) {
      const b = slowBackend(); setRateLimitBackend(b)
      const p = policy(`race-global-${trial}`, 10)
      const results = await Promise.all(Array.from({ length: 60 }, (_, i) => checkRateLimit(req(`203.0.113.${i + 1}`), p)))
      const allowed = results.filter(r => r.allowed).length
      assert.ok(allowed <= 10, `trial ${trial}: ${allowed} allowed (limit 10)`)
      assert.equal(b.live(), allowed, "denied requests withdraw their rows, so only allowed hits remain")
      // Documented trade-off: record-then-count is conservative under an extreme simultaneous burst
      // (every request may see the others' rows and back off). It never over-admits, and because
      // denied hits are withdrawn the budget is available again right after the burst.
      const after = await checkRateLimit(req("203.0.113.250"), p)
      assert.ok(after.allowed, `trial ${trial}: budget must recover after the burst`)
    }
  })

  await test("RACE: 20 simultaneous requests from ONE client never exceed the per-client limit", async () => {
    const b = slowBackend(); setRateLimitBackend(b)
    const p = policy("race-client", 1000)
    const results = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(req("203.0.113.200"), p)))
    assert.ok(results.filter(r => r.allowed).length <= 5)
    assert.ok(b.live() <= 5)
  })

  await test("per-client limit is enforced through the SHARED store (a second instance sees prior hits)", async () => {
    const b = slowBackend(); setRateLimitBackend(b)
    const p = policy("shared", 1000)
    // another instance already recorded 5 hits for this client
    const key = clientKeyFromRequest(req("203.0.113.77"))
    for (let i = 0; i < 5; i++) await b.record("shared", key)
    const r = await checkRateLimit(req("203.0.113.77"), p)
    assert.equal(r.allowed, false)
    if (!r.allowed) assert.equal(r.reason, "client")
  })

  await test("denied requests do not consume the global budget (rows withdrawn)", async () => {
    const b = slowBackend(); setRateLimitBackend(b)
    const p = policy("withdraw", 1000)
    const key = clientKeyFromRequest(req("203.0.113.88"))
    for (let i = 0; i < 5; i++) await b.record("withdraw", key)
    const before = b.live()
    const r = await checkRateLimit(req("203.0.113.88"), p)
    assert.equal(r.allowed, false)
    assert.equal(b.live(), before, "the denied request's own hit was deleted")
  })

  await test("store errors: request is served degraded (never a 500) and per-instance limit still applies", async () => {
    setRateLimitBackend({ count: async () => { throw new Error("db down") }, record: async () => { throw new Error("db down") }, remove: async () => { throw new Error("db down") } })
    const p = policy("outage", 1000)
    const out = []
    for (let i = 0; i < 7; i++) out.push(await checkRateLimit(req("203.0.113.90"), p))
    assert.ok(out.slice(0, 5).every(r => r.allowed && r.degraded))
    assert.equal(out[5].allowed, false)
  })

  await test("store HANGS: the request stops waiting at the deadline and degrades (the DB call is NOT cancelled)", async () => {
    setRateLimitBackend({ count: () => new Promise(() => {}), record: () => new Promise(() => {}), remove: () => new Promise(() => {}) })
    const t0 = Date.now()
    const r = await checkRateLimit(req("203.0.113.91"), policy("hang", 1000))
    const dt = Date.now() - t0
    assert.ok(r.allowed && r.degraded)
    assert.ok(dt >= DB_DEADLINE_MS - 50 && dt < DB_DEADLINE_MS + 1500, `took ${dt}ms`)
  })

  await test("count failure after a successful insert withdraws the row and degrades", async () => {
    const b = slowBackend()
    setRateLimitBackend({ ...b, count: async () => { throw new Error("boom") } })
    const r = await checkRateLimit(req("203.0.113.92"), policy("countfail", 1000))
    assert.ok(r.allowed && r.degraded)
    assert.equal(b.live(), 0)
  })

  await test("client key is a 128-bit hex HMAC; never contains the raw IP", () => {
    const k = clientKeyFromRequest(req("203.0.113.5"))
    assert.match(k, /^[0-9a-f]{32}$/)
    assert.ok(!k.includes("203") || !k.includes("113.5"))
    assert.equal(k, clientKeyFromRequest(req("203.0.113.5")))
    assert.notEqual(k, clientKeyFromRequest(req("203.0.113.6")))
  })

  await test("key material comes from the service secret (rotates with it) and has no constant fallback", () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-secret-A"
      const a = clientKeyFromRequest(req("198.51.100.1")); const ta = scopeTag("s")
      process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-secret-B"
      assert.notEqual(a, clientKeyFromRequest(req("198.51.100.1")))
      assert.notEqual(ta, scopeTag("s"))
      delete process.env.SUPABASE_SERVICE_ROLE_KEY // random per-process key, not a guessable constant
      const c = clientKeyFromRequest(req("198.51.100.1"))
      assert.match(c, /^[0-9a-f]{32}$/)
      assert.ok(c !== a)
    } finally { if (saved === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved }
  })

  await test("row tag is scope-specific, 'rl:'-prefixed and independent of any request-controlled field", () => {
    assert.match(scopeTag("resume-quick-score"), /^rl:[0-9a-f]{32}$/)
    assert.notEqual(scopeTag("a"), scopeTag("b"))
    assert.equal(scopeTag("a"), scopeTag("a"))
  })

  // ───────────── item 1: bounded in-memory store ─────────────
  await test("MEMORY: existing behaviour preserved (limit, remaining, resetAt, window expiry)", () => {
    __rateLimitReset()
    const r1 = rateLimit("k", 2, 50); const r2 = rateLimit("k", 2, 50); const r3 = rateLimit("k", 2, 50)
    assert.deepEqual([r1.success, r1.remaining, r2.success, r2.remaining, r3.success, r3.remaining], [true, 1, true, 0, false, 0])
    assert.ok(r3.resetAt === r1.resetAt)
  })
  await test("MEMORY: a window that has expired starts a fresh count", async () => {
    __rateLimitReset()
    rateLimit("w", 1, 20); assert.equal(rateLimit("w", 1, 20).success, false)
    await sleep(40)
    assert.equal(rateLimit("w", 1, 20).success, true)
  })
  await test("MEMORY: store never exceeds RATE_LIMIT_MAX_KEYS under a flood of distinct keys", () => {
    __rateLimitReset()
    for (let i = 0; i < RATE_LIMIT_MAX_KEYS * 3; i++) rateLimit(`flood:${i}`, 5, 600_000)
    assert.equal(__rateLimitStoreSize(), RATE_LIMIT_MAX_KEYS)
  })
  await test("MEMORY: expired entries are pruned (lazily) instead of piling up", async () => {
    __rateLimitReset()
    for (let i = 0; i < 500; i++) rateLimit(`short:${i}`, 5, 5) // expire almost immediately
    assert.equal(__rateLimitStoreSize(), 500)
    await sleep(30)
    // force the sweep interval to have elapsed without waiting a minute
    const realNow = Date.now; Date.now = () => realNow() + RATE_LIMIT_SWEEP_INTERVAL_MS + 1
    try { rateLimit("trigger", 5, 600_000) } finally { Date.now = realNow }
    assert.ok(__rateLimitStoreSize() <= 2, `size ${__rateLimitStoreSize()} after sweep`)
  })
  await test("MEMORY: when full, expired keys are reclaimed BEFORE any live key is evicted", async () => {
    __rateLimitReset()
    rateLimit("live", 1, 600_000)
    for (let i = 0; i < RATE_LIMIT_MAX_KEYS - 1; i++) rateLimit(`e:${i}`, 5, 5)
    await sleep(30)
    rateLimit("newcomer", 5, 600_000) // store is at the cap: expired ones are swept, not "live"
    assert.equal(rateLimit("live", 1, 600_000).success, false, "live counter survived")
    assert.ok(__rateLimitStoreSize() < RATE_LIMIT_MAX_KEYS)
  })

  // ───────────── item 2: trusted client IP ─────────────
  const withXff = (v: string, extra: Record<string, string> = {}) => new Request("http://x", { headers: { "x-forwarded-for": v, ...extra } })
  await test("IP: a client-supplied leading x-forwarded-for value is NOT trusted (appending proxy)", () => {
    assert.equal(getTrustedClientIp(withXff("1.2.3.4, 203.0.113.9")), "203.0.113.9")
    assert.equal(getTrustedClientIp(withXff("9.9.9.9, 8.8.8.8, 203.0.113.9")), "203.0.113.9")
  })
  await test("IP: rotating the spoofable prefix does not change the client's bucket key", () => {
    const a = clientKeyFromRequest(withXff("1.1.1.1, 203.0.113.9"))
    const b = clientKeyFromRequest(withXff("2.2.2.2, 203.0.113.9"))
    assert.equal(a, b)
    assert.notEqual(a, clientKeyFromRequest(withXff("1.1.1.1, 203.0.113.10")))
  })
  await test("IP: overwriting proxy (single entry) works; hop count is honoured", () => {
    assert.equal(getTrustedClientIp(withXff("203.0.113.9")), "203.0.113.9")
    assert.equal(getTrustedClientIp(withXff("198.51.100.7, 10.0.0.2, 10.0.0.3"), 2), "10.0.0.2")
    assert.equal(getTrustedClientIp(withXff("203.0.113.9"), 3), "203.0.113.9", "hops larger than the chain clamp to the first entry")
  })
  await test("IP: garbage / oversized values fall back to the shared 'unknown' bucket", () => {
    assert.equal(getTrustedClientIp(withXff("not-an-ip")), "unknown")
    assert.equal(getTrustedClientIp(withXff("x".repeat(200))), "unknown")
    assert.equal(getTrustedClientIp(new Request("http://x")), "unknown")
  })
  await test("IP: x-real-ip is ignored off-Vercel (client-controlled) and honoured on Vercel", () => {
    const saved = process.env.VERCEL
    try {
      delete process.env.VERCEL
      assert.equal(getTrustedClientIp(new Request("http://x", { headers: { "x-real-ip": "6.6.6.6" } })), "unknown")
      process.env.VERCEL = "1"
      assert.equal(getTrustedClientIp(new Request("http://x", { headers: { "x-real-ip": "6.6.6.6" } })), "6.6.6.6")
    } finally { if (saved === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved }
  })
  await test("IP: IPv6 addresses are accepted", () => {
    assert.equal(getTrustedClientIp(withXff("2001:db8::1")), "2001:db8::1")
  })

  // ───────────── item 3: operations that finish AFTER the deadline ─────────────
  function lateBackend(opts: { insertMs?: number; removeMs?: number; removeFails?: number; countMs?: number }) {
    const rows: { id: number; live: boolean }[] = []
    let n = 0
    let removeAttempts = 0
    const b: RateLimitBackend & { rows: typeof rows; live: () => number; removeAttempts: () => number } = {
      rows, live: () => rows.filter(r => r.live).length, removeAttempts: () => removeAttempts,
      async record() { await sleep(opts.insertMs ?? 0); const id = ++n; rows.push({ id, live: true }); return String(id) },
      async count() { await sleep(opts.countMs ?? 0); return rows.filter(r => r.live).length },
      async remove(_s, id) {
        removeAttempts++
        await sleep(opts.removeMs ?? 0)
        if (removeAttempts <= (opts.removeFails ?? 0)) throw new Error("remove failed")
        const r = rows.find(x => String(x.id) === id); if (r) r.live = false
      },
    }
    return b
  }
  const unhandled: unknown[] = []
  process.on("unhandledRejection", e => unhandled.push(e))

  await test("LATE INSERT: a row that lands after the deadline is withdrawn, not left in the counters", async () => {
    const b = lateBackend({ insertMs: 120 }); setRateLimitBackend(b); setRateLimitDeadlineMs(30)
    try {
      const r = await checkRateLimit(req("203.0.113.101"), policy("late-insert", 1000))
      assert.ok(r.allowed && r.degraded, "served degraded at the deadline")
      assert.equal(b.live(), 0, "row has not landed yet at response time")
      await sleep(300)
      assert.equal(b.rows.length, 1, "the insert did complete (the deadline did not cancel it)")
      assert.equal(b.live(), 0, "…and was withdrawn once it landed")
    } finally { setRateLimitDeadlineMs(null) }
  })
  await test("LATE INSERT: a late FAILING insert is harmless (no row, no unhandled rejection)", async () => {
    const b = lateBackend({}); setRateLimitDeadlineMs(30)
    setRateLimitBackend({ ...b, record: async () => { await sleep(100); throw new Error("late boom") } })
    try {
      const r = await checkRateLimit(req("203.0.113.102"), policy("late-fail", 1000))
      assert.ok(r.allowed && r.degraded)
      await sleep(200)
      assert.equal(unhandled.length, 0)
    } finally { setRateLimitDeadlineMs(null) }
  })
  await test("LATE COUNT: a count that finishes after the deadline withdraws our row and degrades; no stray rows", async () => {
    const b = lateBackend({ countMs: 120 }); setRateLimitBackend(b); setRateLimitDeadlineMs(30)
    try {
      const r = await checkRateLimit(req("203.0.113.103"), policy("late-count", 1000))
      assert.ok(r.allowed && r.degraded)
      await sleep(250)
      assert.equal(b.live(), 0)
      assert.equal(unhandled.length, 0)
    } finally { setRateLimitDeadlineMs(null) }
  })
  await test("LATE DELETE: a withdrawal that misses the deadline still lands; failed withdrawals are retried by later requests", async () => {
    // first remove fails outright → goes to the orphan queue → drained (and succeeds) on the next request
    const b = lateBackend({ removeFails: 1 }); setRateLimitBackend(b)
    const p = policy("late-delete", 1000)
    const key = clientKeyFromRequest(req("203.0.113.104"))
    for (let i = 0; i < 5; i++) await b.record("late-delete", key) // client already at its limit
    const before = __orphanCount()
    const denied = await checkRateLimit(req("203.0.113.104"), p)
    assert.equal(denied.allowed, false)
    assert.equal(__orphanCount(), before + 1, "failed withdrawal was queued, not forgotten")
    const stray = b.rows[b.rows.length - 1] // the denied request's own row
    assert.equal(stray.live, true, "stray row still present until retried")
    await checkRateLimit(req("203.0.113.105"), p) // any later request drains the queue
    await sleep(50)
    assert.equal(__orphanCount(), before)
    assert.equal(stray.live, false, "stray row was removed by the retry")
    assert.equal(b.removeAttempts() >= 2, true)
  })
  await test("LATE DELETE: slow withdrawal (past deadline) is queued, then completes", async () => {
    const b = lateBackend({ removeMs: 100 }); setRateLimitBackend(b); setRateLimitDeadlineMs(30)
    try {
      const p = policy("slow-delete", 1000)
      const key = clientKeyFromRequest(req("203.0.113.106"))
      for (let i = 0; i < 5; i++) await b.record("slow-delete", key)
      const t0 = Date.now()
      const r = await checkRateLimit(req("203.0.113.106"), p)
      assert.equal(r.allowed, false)
      assert.ok(Date.now() - t0 < 500, "response is not held up by a slow delete")
      await sleep(250)
      assert.equal(b.live(), 5, "the denied request's own row was eventually deleted (the DB op was not cancelled)")
    } finally { setRateLimitDeadlineMs(null) }
  })
  await test("no unhandled rejections anywhere in this file", () => assert.equal(unhandled.length, 0))

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed ? 1 : 0)
}
main()
