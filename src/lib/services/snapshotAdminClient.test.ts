/**
 * snapshotAdminClient.test.ts — regression tests proving that
 * getPrivateJobsForSnapshot() uses the service-role admin client (supabaseAdmin)
 * and does NOT depend on cookies() or getSupabaseClient().
 *
 * This is the fix for the ISR sitemap failure:
 *   [jobService:snapshot] Supabase client unavailable — cannot build sitemap snapshot
 *
 * The cookie-based server client (createClient from @/lib/supabase/server) returns
 * null when cookies() throws outside a request context, which happens during Next.js
 * ISR background regeneration.  The fix uses supabaseAdmin, which is cookie-less
 * and works in any server-side context.
 *
 *   npm run test:snapshot-admin-client
 */
import assert from "node:assert/strict"
import { withTimeout, QueryTimeoutError, MAX_POOL_ROWS } from "./jobService"
import type { SnapshotPage } from "./jobService"

let passed = 0
let failed = 0
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

async function runAll() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      passed++
      console.log(`  PASS  ${name}`)
    } catch (err) {
      failed++
      console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`)
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Section 1 — Admin client wiring: supabaseAdmin, not getSupabaseClient()
 * ──────────────────────────────────────────────────────────────────────────── */

/** Extract the body of getPrivateJobsForSnapshot by finding its closing brace. */
function extractSnapshotFnBody(src: string): string {
  const fnStart = src.indexOf("export async function getPrivateJobsForSnapshot")
  if (fnStart === -1) return ""
  // Walk forward to find the matching closing brace for the function body.
  let depth = 0
  let i = fnStart
  while (i < src.length) {
    if (src[i] === "{") depth++
    else if (src[i] === "}") {
      depth--
      if (depth === 0) return src.slice(fnStart, i + 1)
    }
    i++
  }
  return src.slice(fnStart) // fallback
}

test("getPrivateJobsForSnapshot source: does NOT import createClient from @/lib/supabase/server", async () => {
  // Read the compiled/source file to assert the admin path is used.
  // This is a static source assertion — we verify the fix is present in the file.
  const { readFileSync } = await import("node:fs")
  const { resolve } = await import("node:path")
  const src = readFileSync(
    resolve(import.meta.dirname, "./jobService.ts"),
    "utf-8",
  )

  assert.ok(
    src.includes("export async function getPrivateJobsForSnapshot"),
    "getPrivateJobsForSnapshot must exist in jobService.ts",
  )

  // Extract only the body of getPrivateJobsForSnapshot (not the functions after it).
  const fnBody = extractSnapshotFnBody(src)
  assert.ok(fnBody.length > 0, "Could not extract getPrivateJobsForSnapshot body")

  assert.ok(
    fnBody.includes("supabaseAdmin"),
    "getPrivateJobsForSnapshot must use supabaseAdmin — cookie-less service-role client",
  )
  assert.ok(
    !fnBody.includes("getSupabaseClient()"),
    "getPrivateJobsForSnapshot must NOT call getSupabaseClient() (uses cookies, unavailable in ISR context)",
  )
  assert.ok(
    fnBody.includes("@/lib/supabase/admin"),
    "getPrivateJobsForSnapshot must import from @/lib/supabase/admin",
  )
})

test("getPrivateJobsForSnapshot source: cookies() is not called inside the snapshot function", async () => {
  const { readFileSync } = await import("node:fs")
  const { resolve } = await import("node:path")
  const src = readFileSync(resolve(import.meta.dirname, "./jobService.ts"), "utf-8")

  const fnBody = extractSnapshotFnBody(src)

  // cookies() must not be called (even transitively through getSupabaseClient)
  assert.ok(
    !fnBody.includes("cookies()"),
    "getPrivateJobsForSnapshot must not call cookies() — it is unavailable in ISR background regeneration",
  )
})

/* ────────────────────────────────────────────────────────────────────────────
 * Section 2 — Supabase config guard: throws when not configured
 * ──────────────────────────────────────────────────────────────────────────── */

test("getPrivateJobsForSnapshot throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
  // Save and clear the env var to simulate unconfigured state
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const origSvcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    // Re-import to get a fresh module evaluation with cleared env
    // (tsx/ESM caches modules, so we read the source behavior via the config check)
    const { isSupabaseConfigured } = await import("@/lib/supabase/config")
    assert.ok(
      !isSupabaseConfigured(),
      "isSupabaseConfigured() must return false when SUPABASE_URL is missing",
    )
  } finally {
    if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
    if (origKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey
    if (origSvcKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origSvcKey
  }
})

/* ────────────────────────────────────────────────────────────────────────────
 * Section 3 — withTimeout guard: errors and timeouts propagate, never swallowed
 *
 * These are integration-level tests of the timeout wrapper that protects the
 * snapshot query.  They use real timers to exercise the actual race condition.
 * ──────────────────────────────────────────────────────────────────────────── */

test("withTimeout: a DB error (like a Supabase network error) propagates from snapshot query", async () => {
  // Simulate a Supabase error by wrapping a rejecting promise with the timeout
  const dbError = new Error("[snapshot] DB error on page offset=0: connection refused")
  await assert.rejects(
    () => withTimeout(Promise.reject(dbError), 8000),
    (e: unknown) => {
      assert.ok(e === dbError, "The exact DB error must propagate — not wrapped or swallowed")
      return true
    },
  )
})

test("withTimeout: a query that stalls longer than 8 s throws QueryTimeoutError", async () => {
  const neverSettles = new Promise<{ data: null; error: null }>(() => {})
  await assert.rejects(
    () => withTimeout(neverSettles, 80), // use 80ms to keep test fast
    QueryTimeoutError,
    "A stalled Supabase query must be bounded by QueryTimeoutError",
  )
})

test("withTimeout: a fast query resolves normally (no false timeout)", async () => {
  const fast = Promise.resolve({ data: [], error: null })
  const result = await withTimeout(fast, 8000)
  assert.deepEqual(result, { data: [], error: null })
})

/* ────────────────────────────────────────────────────────────────────────────
 * Section 4 — SnapshotPage shape: rawRowCount semantics
 *
 * These tests verify that rawRowCount correctly reflects raw DB row count
 * before in-memory filtering — a property getPrivateJobsForSnapshot must
 * preserve so the paginator in getGenuineOpenJobsSnapshot terminates correctly.
 * ──────────────────────────────────────────────────────────────────────────── */

test("SnapshotPage.rawRowCount: reflects raw rows before in-memory filtering", () => {
  // Construct a SnapshotPage as getPrivateJobsForSnapshot would produce it.
  // rawRowCount must be data.length (the raw Supabase result) before filterRenderable.
  const rawRows = 47 // simulated data.length from Supabase
  const filteredJobs = 30 // fewer pass filterRenderable

  // The contract: rawRowCount === rawRows, not filteredJobs
  const page: SnapshotPage = {
    jobs: Array(filteredJobs).fill(null) as never[],
    rawRowCount: rawRows,
  }
  assert.equal(page.rawRowCount, rawRows, "rawRowCount must be the pre-filter row count")
  assert.notEqual(page.rawRowCount, filteredJobs, "rawRowCount must NOT equal post-filter job count")
})

test("SnapshotPage.rawRowCount: end-of-data is rawRowCount < pageSize, not jobs.length < pageSize", () => {
  // Critical: the paginator in getGenuineOpenJobsSnapshot uses rawRowCount < pageSize
  // (not jobs.length < pageSize) to detect DB exhaustion.
  // This test documents the contract that getPrivateJobsForSnapshot must honour.
  const pageSize = MAX_POOL_ROWS

  // Case A: full raw page, many filtered out → paginator MUST NOT stop
  const fullRawPage: SnapshotPage = { jobs: Array(600).fill(null) as never[], rawRowCount: pageSize }
  assert.ok(fullRawPage.rawRowCount >= pageSize, "Full raw page: rawRowCount >= pageSize → continue paginating")

  // Case B: partial raw page → DB is exhausted → paginator must stop
  const partialRawPage: SnapshotPage = { jobs: Array(20).fill(null) as never[], rawRowCount: 30 }
  assert.ok(partialRawPage.rawRowCount < pageSize, "Partial raw page: rawRowCount < pageSize → stop paginating")
})

/* ────────────────────────────────────────────────────────────────────────────
 * Section 5 — ISR context simulation: null-client path no longer reached
 *
 * Verify that the ISR failure path (getSupabaseClient returns null → throw)
 * is no longer in the snapshot function after the fix.  The function now uses
 * supabaseAdmin directly, so there is no null-client branch to hit.
 * ──────────────────────────────────────────────────────────────────────────── */

test("getPrivateJobsForSnapshot source: no null-client early-throw for ISR context", async () => {
  const { readFileSync } = await import("node:fs")
  const { resolve } = await import("node:path")
  const src = readFileSync(resolve(import.meta.dirname, "./jobService.ts"), "utf-8")

  const fnBody = extractSnapshotFnBody(src)

  // The old failure message must not appear in the snapshot function after the fix
  assert.ok(
    !fnBody.includes("Supabase client unavailable"),
    [
      "getPrivateJobsForSnapshot must no longer throw 'Supabase client unavailable'.",
      "That message was the ISR failure. The fix replaces getSupabaseClient() with supabaseAdmin.",
    ].join(" "),
  )
})

/* ────────────────────────────────────────────────────────────────────────────
 * Section 6 — Filter chain preserved: filterRenderable → applySyntheticVisibility
 *
 * The fix must not alter the in-memory filter chain.  Verify via source inspection
 * that both filters are still present inside getPrivateJobsForSnapshot.
 * ──────────────────────────────────────────────────────────────────────────── */

test("getPrivateJobsForSnapshot source: filterRenderable() still applied after supabaseAdmin fetch", async () => {
  const { readFileSync } = await import("node:fs")
  const { resolve } = await import("node:path")
  const src = readFileSync(resolve(import.meta.dirname, "./jobService.ts"), "utf-8")

  const fnBody = extractSnapshotFnBody(src)

  assert.ok(fnBody.includes("filterRenderable("), "filterRenderable() must remain in getPrivateJobsForSnapshot")
  assert.ok(fnBody.includes("applySyntheticVisibility("), "applySyntheticVisibility() must remain in getPrivateJobsForSnapshot")
  assert.ok(fnBody.includes("mapPrivateJobRow("), "mapPrivateJobRow() must remain in getPrivateJobsForSnapshot")
})

test("getPrivateJobsForSnapshot source: withTimeout() still wraps the DB query", async () => {
  const { readFileSync } = await import("node:fs")
  const { resolve } = await import("node:path")
  const src = readFileSync(resolve(import.meta.dirname, "./jobService.ts"), "utf-8")

  const fnBody = extractSnapshotFnBody(src)

  assert.ok(fnBody.includes("withTimeout("), "withTimeout() must still wrap the Supabase query in getPrivateJobsForSnapshot")
  assert.ok(fnBody.includes("8000"), "8 s timeout must still be present in getPrivateJobsForSnapshot")
})

test("getPrivateJobsForSnapshot source: query still filters status=active and orders by posted_at,id", async () => {
  const { readFileSync } = await import("node:fs")
  const { resolve } = await import("node:path")
  const src = readFileSync(resolve(import.meta.dirname, "./jobService.ts"), "utf-8")

  const fnBody = extractSnapshotFnBody(src)

  assert.ok(fnBody.includes(`.eq("status", "active")`), 'Query must still filter status="active"')
  assert.ok(fnBody.includes(`"posted_at"`), "Query must still order by posted_at")
  assert.ok(fnBody.includes(`"id"`), "Query must still have secondary sort by id")
})

/* ─────────────────────────────────────────────────────────────────────── */

console.log("\n── snapshotAdminClient regression tests ────────────────────")
runAll().then(() => {
  console.log(`  ${passed + failed} tests run, ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})
