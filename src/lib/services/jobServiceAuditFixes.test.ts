/**
 * jobServiceAuditFixes.test.ts — regression tests for the Supabase/Vercel audit fixes.
 *   npm run test:jobservice-audit
 *
 * 1. getJobById must NOT query `jobs` for ids that are not uuids ("live-priv-24", "ver-priv-1472"…).
 *    Production logged ~470 Postgres 22P02 "invalid input syntax for type uuid" errors from these.
 * 2. A real uuid must still reach the `jobs` table (behaviour preserved).
 * 3. getJobs(..., { cookieless: true }) reads through the anonymous client (no cookies() call), so ISR
 *    pages cannot flip to dynamic at runtime.
 * No network: global fetch is stubbed; nothing touches a real Supabase project.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://audit-test.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
process.env.NEXT_PUBLIC_JOB_DATA_SOURCE = "supabase" // exercise the live-DB branch, not local demo inventory

// Outside a Next.js request `cookies()` throws and the cookie client returns null, which would make the
// non-cookieless assertions vacuous. Stub next/headers so the cookie client behaves as in a real request.
// eslint-disable-next-line @typescript-eslint/no-require-imports
let cookiesCalls = 0
const NodeModule = require("node:module") as { _load: (req: string, ...rest: unknown[]) => unknown }
const realLoad = NodeModule._load
NodeModule._load = function (req: string, ...rest: unknown[]) {
  if (req === "next/headers") return { cookies: async () => { cookiesCalls++; return { getAll: () => [], set: () => {} } } }
  return realLoad.call(this, req, ...rest)
}

type Call = { url: string; apikey: string }
const calls: Call[] = []
globalThis.fetch = (async (input: unknown, init?: { headers?: unknown }) => {
  const url = typeof input === "string" ? input : (input as { url?: string }).url ?? String(input)
  const h = new Headers((init?.headers as HeadersInit) ?? {})
  calls.push({ url, apikey: h.get("apikey") ?? "" })
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const jobsCalls = () => calls.filter(c => /\/rest\/v1\/jobs(\?|$)/.test(c.url))

async function main() {
  const { getJobById, getJobs, isUuid } = await import("./jobService")

  await test("isUuid accepts uuids and rejects synthetic ids", async () => {
    assert.equal(isUuid("3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f"), true)
    for (const id of ["live-priv-24", "ver-priv-1472", "priv-1", "himalayas:abc", "", "3f2a9b6e-1111-4c2d-8a10"]) {
      assert.equal(isUuid(id), false, id)
    }
  })

  await test("getJobById never queries `jobs` for non-uuid ids", async () => {
    for (const id of ["live-priv-24", "ver-priv-1472", "priv-1"]) {
      calls.length = 0
      await getJobById(id).catch(() => null)
      assert.equal(jobsCalls().length, 0, `${id} reached the jobs table`)
    }
  })

  await test("getJobById still queries `jobs` for a real uuid", async () => {
    calls.length = 0
    await getJobById("3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f").catch(() => null)
    assert.ok(jobsCalls().length >= 1, "uuid lookup should hit the jobs table")
    assert.ok(jobsCalls().every(c => /id=eq\.3f2a9b6e/.test(c.url)))
  })

  await test("getJobs({cookieless}) queries with the anon key and never needs cookies()", async () => {
    calls.length = 0
    cookiesCalls = 0
    await getJobs({ limit: 1 }, { cookieless: true }).catch(() => null)
    assert.equal(cookiesCalls, 0, "cookieless read must not call cookies() (it flips ISR pages to dynamic)")
    const q = jobsCalls()
    assert.ok(q.length >= 1, "expected a jobs query through the public client")
    assert.ok(q.every(c => c.apikey === "test-anon-key"), "public client must use the anon key only")
  })

  await test("public client module is cookie-free and never uses the service-role key", async () => {
    const src = readFileSync(join(__dirname, "../supabase/public.ts"), "utf8")
    // strip comments so the explanatory header doesn't trip the checks
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
    assert.ok(!/next\/headers|cookies\(/.test(code), "public.ts must not touch cookies")
    assert.ok(!/SERVICE_ROLE/.test(code), "public.ts must not use the service-role key")
  })

  await test("ISR/SEO read paths opt in to the cookie-less client", async () => {
    for (const f of ["../seo/genuineJobs.ts", "../seo/landing.ts", "./visibleCounts.ts"]) {
      const code = readFileSync(join(__dirname, f), "utf8")
      assert.ok(/cookieless: true|PUBLIC_READ/.test(code), `${f} should read cookie-less`)
    }
  })

  console.log(`\njobService audit-fix tests: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}
main()
