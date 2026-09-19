/**
 * govtIntegrity.test.ts — Phase 1 government data integrity + ingestion safety.
 *
 *   npm run test:seo-phase1
 *
 * Covers: record_type derivation (mirrors the SQL backfill), stale-seed protection
 * (resolveGovtPool + seed policy), compare-before-write ingestion planning, and
 * static guards on the migration.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { canEmitJobPosting, deriveRecordType, govtRecordTypeOf, isGovtRecordType, GOVT_RECORD_TYPES } from "./recordType"
import { resolveGovtPool, type GovtPoolSnapshot } from "../services/govtPoolResolver"
import { planIngestWrites } from "../services/govtIngestPlan"
import { govtLastKnownGoodMaxAgeMs, isGovtSeedFallbackAllowed } from "../config/govtSeedPolicy"

let passed = 0
let failed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

async function main() {
  /* ------------------------------ record_type ------------------------------ */
  await test("record_type domain matches the migration CHECK constraint", () => {
    const sql = read("supabase/migrations/20260727000001_govt_jobs_record_integrity.sql")
    for (const t of GOVT_RECORD_TYPES) assert.ok(sql.includes(`'${t}'`), `migration must allow '${t}'`)
    assert.equal(GOVT_RECORD_TYPES.length, 8)
    assert.equal(isGovtRecordType("notification"), true)
    assert.equal(isGovtRecordType("job"), false)
  })
  await test("derive: informational tabs map to their own type", () => {
    assert.equal(deriveRecordType({ tab: "results", title: "x" }), "result")
    assert.equal(deriveRecordType({ tab: "admit", title: "x" }), "admit_card")
    assert.equal(deriveRecordType({ tab: "answer", title: "x" }), "answer_key")
    assert.equal(deriveRecordType({ tab: "syllabus", title: "x" }), "syllabus")
  })
  await test("derive: recruitment tabs are notifications; upcoming/scholarships/unknown are 'other'", () => {
    for (const tab of ["latest", "railway", "banking", "ssc", "upsc", "state", "psu"]) {
      assert.equal(deriveRecordType({ tab, title: "IBPS Clerk Recruitment 2026" }), "notification", tab)
    }
    assert.equal(deriveRecordType({ tab: "upcoming", title: "Upcoming exam" }), "other")
    assert.equal(deriveRecordType({ tab: "scholarships", title: "NSP Scholarship" }), "other")
    assert.equal(deriveRecordType({ tab: "", title: "" }), "other")
  })
  await test("derive: a misfiled informational title is not treated as a notification", () => {
    assert.equal(deriveRecordType({ tab: "latest", title: "SSC CGL Answer Key 2026" }), "answer_key")
    assert.equal(deriveRecordType({ tab: "latest", title: "RRB NTPC Admit Card 2026" }), "admit_card")
    assert.equal(deriveRecordType({ tab: "latest", title: "UPSC CSE Hall Ticket" }), "admit_card")
    assert.equal(deriveRecordType({ tab: "ssc", title: "SSC CHSL Cut Off 2026" }), "cutoff")
    assert.equal(deriveRecordType({ tab: "latest", title: "IBPS PO Result 2026" }), "result")
    assert.equal(deriveRecordType({ tab: "latest", title: "State Merit List 2026" }), "result")
    assert.equal(deriveRecordType({ tab: "latest", title: "IBPS Clerk Previous Year Question Papers" }), "previous_paper")
    assert.equal(deriveRecordType({ tab: "latest", title: "IBPS Clerk Syllabus 2026" }), "syllabus")
  })
  await test("derive: a recruitment title that merely mentions a syllabus stays a notification", () => {
    assert.equal(deriveRecordType({ tab: "latest", title: "IBPS Clerk Recruitment 2026 Notification with Syllabus" }), "notification")
  })
  await test("govtRecordTypeOf: stored valid value wins; invalid/absent falls back to derivation", () => {
    assert.equal(govtRecordTypeOf({ recordType: "result", tab: "latest", title: "Recruitment" }), "result")
    assert.equal(govtRecordTypeOf({ record_type: "other", tab: "latest", title: "Recruitment" }), "other")
    assert.equal(govtRecordTypeOf({ recordType: "bogus", tab: "latest", title: "Recruitment 2026" }), "notification")
    assert.equal(govtRecordTypeOf({ tab: "results", title: "x" }), "result")
  })
  await test("ONLY a notification may emit JobPosting", () => {
    for (const t of GOVT_RECORD_TYPES) assert.equal(canEmitJobPosting(t), t === "notification", t)
  })

  /* -------------------------- stale-seed protection -------------------------- */
  type Row = { id: string; active?: boolean }
  const real: Row[] = [{ id: "real-1" }, { id: "real-2" }]
  const seed: Row[] = [{ id: "seed-1" }, { id: "seed-2" }]
  const mk = (over: Partial<Parameters<typeof resolveGovtPool<Row>>[0]> & { fetchStrict: () => Promise<Row[]> }) => {
    let lkg: GovtPoolSnapshot<Row> | null = null
    let t = 1_000_000
    return {
      deps: {
        getLkg: () => lkg, setLkg: (s: GovtPoolSnapshot<Row>) => { lkg = s },
        allowSeed: false, seed: () => seed, isActive: (r: Row) => r.active !== false,
        now: () => t, maxAgeMs: 24 * 3600_000, warn: () => {}, ...over,
      } as Parameters<typeof resolveGovtPool<Row>>[0],
      advance: (ms: number) => { t += ms },
    }
  }
  await test("healthy read → source 'db' and refreshes last-known-good", async () => {
    const { deps } = mk({ fetchStrict: async () => real })
    const r = await resolveGovtPool(deps)
    assert.equal(r.source, "db"); assert.deepEqual(r.rows, real)
    assert.equal(deps.getLkg()?.rows.length, 2)
  })
  await test("DB failure with NO last-known-good in production policy → honest 'unavailable', NEVER seed rows", async () => {
    const { deps } = mk({ fetchStrict: async () => { throw new Error("egress quota") }, allowSeed: false })
    const r = await resolveGovtPool(deps)
    assert.equal(r.source, "unavailable"); assert.deepEqual(r.rows, []); assert.match(r.error ?? "", /egress/)
  })
  await test("DB failure after a good read → last-known-good REAL data (not seed)", async () => {
    let fail = false
    const { deps } = mk({ fetchStrict: async () => { if (fail) throw new Error("boom"); return real } })
    await resolveGovtPool(deps)
    fail = true
    const r = await resolveGovtPool(deps)
    assert.equal(r.source, "last-known-good"); assert.deepEqual(r.rows, real)
  })
  await test("last-known-good older than the max age is NOT served", async () => {
    let fail = false
    const m = mk({ fetchStrict: async () => { if (fail) throw new Error("boom"); return real } })
    await resolveGovtPool(m.deps)
    fail = true; m.advance(25 * 3600_000)
    const r = await resolveGovtPool(m.deps)
    assert.equal(r.source, "unavailable")
  })
  await test("seed is served only when policy explicitly allows it (dev / opt-in)", async () => {
    const { deps } = mk({ fetchStrict: async () => { throw new Error("no db") }, allowSeed: true })
    const r = await resolveGovtPool(deps)
    assert.equal(r.source, "seed"); assert.deepEqual(r.rows, seed)
  })
  await test("an EMPTY successful read never displaces a fresh last-known-good dataset", async () => {
    let empty = false
    const { deps } = mk({ fetchStrict: async () => (empty ? [] : real) })
    await resolveGovtPool(deps)
    empty = true
    const r = await resolveGovtPool(deps)
    assert.equal(r.source, "last-known-good"); assert.equal(r.rows.length, 2)
  })
  await test("an empty read with nothing cached is an honest empty 'db' result — not seed", async () => {
    const { deps } = mk({ fetchStrict: async () => [], allowSeed: true })
    const r = await resolveGovtPool(deps)
    assert.equal(r.source, "db"); assert.deepEqual(r.rows, [])
  })
  await test("row-level expiry filter is applied to last-known-good rows", async () => {
    let fail = false
    const { deps } = mk({ fetchStrict: async () => { if (fail) throw new Error("x"); return [{ id: "a" }, { id: "b", active: false }] } })
    await resolveGovtPool(deps)
    fail = true
    const r = await resolveGovtPool(deps)
    assert.deepEqual(r.rows.map(x => x.id), ["a"])
  })
  await test("seed policy: forbidden in production unless GOVT_ALLOW_SEED_FALLBACK=true; LKG age configurable", () => {
    assert.equal(isGovtSeedFallbackAllowed({ NODE_ENV: "production" }), false)
    assert.equal(isGovtSeedFallbackAllowed({ NODE_ENV: "production", GOVT_ALLOW_SEED_FALLBACK: "true" }), true)
    assert.equal(isGovtSeedFallbackAllowed({ NODE_ENV: "development" }), true)
    assert.equal(govtLastKnownGoodMaxAgeMs({}), 24 * 3600_000)
    assert.equal(govtLastKnownGoodMaxAgeMs({ GOVT_LKG_MAX_AGE_HOURS: "6" }), 6 * 3600_000)
    assert.equal(govtLastKnownGoodMaxAgeMs({ GOVT_LKG_MAX_AGE_HOURS: "-1" }), 24 * 3600_000)
  })
  await test("static guard: no unconditional seed fallback remains in the govt data layer", () => {
    const stats = read("src/lib/services/govtStatsSource.ts")
    assert.match(stats, /resolveGovtPool/)
    assert.match(stats, /isGovtSeedFallbackAllowed/)
    assert.doesNotMatch(stats, /catch[^}]*return\s+GOVT_JOBS/)
    assert.match(read("src/lib/services/govtJobService.ts"), /isGovtSeedFallbackAllowed/)
  })

  /* ---------------------------- ingestion planning ---------------------------- */
  const NOW = "2026-09-19T00:00:00.000Z"
  const entry = (id: string, hash: string, recordType = "notification") => ({ id, hash, recordType })
  await test("unchanged content_hash → NO write and content_changed_at untouched", () => {
    const plan = planIngestWrites([entry("a", "h1")], [{ id: "a", content_hash: "h1" }], NOW)
    assert.equal(plan.writes.length, 0); assert.equal(plan.unchanged.length, 1)
  })
  await test("changed hash → update with content_changed_at = now", () => {
    const plan = planIngestWrites([entry("a", "h2")], [{ id: "a", content_hash: "h1" }], NOW)
    assert.equal(plan.writes.length, 1)
    assert.equal(plan.writes[0].isNew, false); assert.equal(plan.writes[0].contentChangedAt, NOW)
  })
  await test("new row → insert with content_changed_at = now", () => {
    const plan = planIngestWrites([entry("n", "h9")], [], NOW)
    assert.equal(plan.writes[0].isNew, true); assert.equal(plan.writes[0].contentChangedAt, NOW)
  })
  await test("existing row with NULL hash is rewritten once (to establish the hash)", () => {
    const plan = planIngestWrites([entry("a", "h1")], [{ id: "a", content_hash: null }], NOW)
    assert.equal(plan.writes.length, 1)
  })
  await test("an editor-set record_type is never overwritten by the derived one", () => {
    const plan = planIngestWrites([entry("a", "h2", "notification")], [{ id: "a", content_hash: "h1", record_type: "other" }], NOW)
    assert.equal(plan.writes[0].recordType, "other")
  })
  await test("mixed batch: only new + changed are written", () => {
    const plan = planIngestWrites(
      [entry("same", "s"), entry("chg", "c2"), entry("new", "n")],
      [{ id: "same", content_hash: "s" }, { id: "chg", content_hash: "c1" }], NOW)
    assert.deepEqual(plan.writes.map(w => w.entry.id), ["chg", "new"])
    assert.deepEqual(plan.unchanged.map(u => u.id), ["same"])
  })
  await test("ingestion never fabricates dates: no `postedAt: new Date()` and source date only when real", () => {
    const src = read("src/lib/services/govtAutoUpdate.ts")
    assert.doesNotMatch(src, /postedAt:\s*new Date\(\)/)
    assert.match(src, /parseRealDate\(raw\.publishedAt\)/)
    assert.match(src, /planIngestWrites/)
  })

  await test("ingest run status: a steady-state run (rows unchanged, nothing written) is progress, not 'nothing published'", () => {
    const { computeIngestRunStatus } = require("../services/govtAutoUpdate") as typeof import("../services/govtAutoUpdate")
    const healthy = computeIngestRunStatus({
      failedSources: ["a"], sources: [{ id: "a", label: "a", fetched: 0, published: 0, skipped: 0, error: "x" }],
      totalPublished: 0, totalUnchanged: 40,
    })
    assert.equal(healthy.status, "partial")
    const dead = computeIngestRunStatus({
      failedSources: ["a"], sources: [{ id: "a", label: "a", fetched: 0, published: 0, skipped: 0, error: "x" }],
      totalPublished: 0, totalUnchanged: 0,
    })
    assert.equal(dead.status, "error")
    const src = read("scripts/run-ingestion.ts")
    assert.match(src, /totalPublished \+ \(r\.totalUnchanged \?\? 0\) === 0/)
  })

  /* --------------------------------- migration --------------------------------- */
  await test("migration adds only the minimum columns, additive + idempotent, source date NOT backfilled", () => {
    const sql = read("supabase/migrations/20260727000001_govt_jobs_record_integrity.sql")
    for (const c of ["record_type", "source_published_at", "content_changed_at", "verified_at", "verified_by"]) {
      assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\b`), c)
    }
    assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i)
    assert.doesNotMatch(sql, /UPDATE[^;]*SET[^;]*source_published_at\s*=/i, "must not invent source_published_at")
    assert.match(read("supabase/migrations/20260727000001_govt_jobs_record_integrity.down.sql"), /DROP COLUMN IF EXISTS/)
  })

  console.log(`\ngovt integrity tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
}
main()
