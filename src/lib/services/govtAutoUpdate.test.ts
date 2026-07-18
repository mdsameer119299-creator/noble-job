/**
 * govtAutoUpdate.test.ts — ingest_runs status/error aggregation.
 *   npm run test:ingest-status
 *
 * govtAutoUpdate.ts pulls in supabase-js/next-cache-adjacent config, so this
 * only exercises the pure, exported computeIngestRunStatus() — no I/O, no
 * mocking needed, matching this repo's other dependency-free unit tests.
 */
import assert from "node:assert/strict"
import { computeIngestRunStatus, type AutoUpdateResult } from "./govtAutoUpdate"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

type Source = AutoUpdateResult["sources"][number]
const src = (over: Partial<Source> = {}): Source =>
  ({ id: "x", label: "X", fetched: 0, published: 0, skipped: 0, ...over })

test("all sources clean → success, no error", () => {
  const r = computeIngestRunStatus({
    failedSources: [],
    totalPublished: 10,
    sources: [src({ id: "a", published: 5 }), src({ id: "b", published: 5 })],
  })
  assert.deepEqual(r, { status: "success", error: null })
})

test("a fetch() throw (failedSources) with some publishes → partial", () => {
  const r = computeIngestRunStatus({
    failedSources: ["broken-adapter"],
    totalPublished: 5,
    sources: [src({ id: "ok", published: 5 }), src({ id: "broken-adapter", error: "fetch failed" })],
  })
  assert.equal(r.status, "partial")
  assert.equal(r.error, "failed: broken-adapter")
})

test("REGRESSION — every adapter fetches fine but every persist() write fails: must NOT report success", () => {
  // This is the exact production scenario (Supabase project restricted/
  // quota-exceeded): fetch succeeds for every source, so failedSources stays
  // empty, but persist() fails for all of them and totalPublished is 0.
  const r = computeIngestRunStatus({
    failedSources: [],
    totalPublished: 0,
    sources: [
      src({ id: "mppsc", fetched: 30, error: "persist upsert failed: restricted" }),
      src({ id: "uksssc", fetched: 14, error: "persist upsert failed: restricted" }),
      src({ id: "employment-news", fetched: 7, error: "persist upsert failed: restricted" }),
    ],
  })
  assert.equal(r.status, "error", "0 published across all sources must never be status=success")
  assert.notEqual(r.error, null)
  assert.match(r.error!, /mppsc/)
  assert.match(r.error!, /uksssc/)
  assert.match(r.error!, /employment-news/)
})

test("write failures on SOME sources, others publish fine → partial, only the failing ids listed", () => {
  const r = computeIngestRunStatus({
    failedSources: [],
    totalPublished: 7,
    sources: [
      src({ id: "good", published: 7 }),
      src({ id: "bad", error: "persist upsert failed: restricted" }),
    ],
  })
  assert.equal(r.status, "partial")
  assert.equal(r.error, "failed: bad")
  assert.doesNotMatch(r.error!, /\bgood\b/)
})

test("a source in both failedSources AND sources[].error is not double-listed", () => {
  const r = computeIngestRunStatus({
    failedSources: ["x"],
    totalPublished: 0,
    sources: [src({ id: "x", error: "fetch failed" })],
  })
  assert.equal(r.error, "failed: x")
})

test("empty run (no adapters at all) → success", () => {
  const r = computeIngestRunStatus({ failedSources: [], totalPublished: 0, sources: [] })
  assert.deepEqual(r, { status: "success", error: null })
})

console.log(`\ningest-run status tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
