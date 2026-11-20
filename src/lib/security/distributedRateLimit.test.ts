/**
 * distributedRateLimit.test.ts — race safety, failure modes, row tagging and key hygiene
 * of the cross-instance limiter. Synthetic data only; no network, no database.
 *   npm run test:rate-limit
 */
import assert from "node:assert/strict"
import {
  checkRateLimit, setRateLimitBackend, clientKeyFromRequest, scopeTag, DB_DEADLINE_MS,
  type RateLimitBackend, type RateLimitPolicy,
} from "./distributedRateLimit"

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

  await test("store HANGS: each DB call is cut off at the deadline and the request degrades", async () => {
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

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed ? 1 : 0)
}
main()
