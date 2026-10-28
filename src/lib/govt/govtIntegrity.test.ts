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
import { canEmitJobPosting, deriveRecordType, govtRecordTypeOf, isGovtRecordType, isCurrentGovtNotification, GOVT_RECORD_TYPES } from "./recordType"
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
  await test("current government notifications require a recent source publication date", () => {
    const now = new Date("2026-10-01T00:00:00.000Z")
    assert.equal(isCurrentGovtNotification({ recordType: "notification", sourcePublishedAt: "2026-09-01T00:00:00.000Z" }, now), true)
    assert.equal(isCurrentGovtNotification({ recordType: "notification", sourcePublishedAt: "2025-01-01T00:00:00.000Z" }, now), false)
    // No publication date AND no created_at → not current (no timestamp to check freshness against)
    assert.equal(isCurrentGovtNotification({ recordType: "notification", sourcePublishedAt: null }, now), false)
    assert.equal(isCurrentGovtNotification({ recordType: "result", sourcePublishedAt: "2026-09-01T00:00:00.000Z" }, now), false)
  })

  await test("created_at fallback: rows without source_published_at use ingestion timestamp for freshness", () => {
    const now = new Date("2026-10-01T00:00:00.000Z")
    // Recent created_at → current (even without source_published_at)
    assert.equal(isCurrentGovtNotification({
      recordType: "notification", sourcePublishedAt: undefined,
      created_at: "2026-09-15T12:00:00.000Z",
    }, now), true)
    // Old created_at (>1 year) → not current
    assert.equal(isCurrentGovtNotification({
      recordType: "notification", sourcePublishedAt: undefined,
      created_at: "2025-01-01T00:00:00.000Z",
    }, now), false)
    // source_published_at takes precedence over created_at
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      sourcePublishedAt: "2026-09-01T00:00:00.000Z",
      created_at: "2025-01-01T00:00:00.000Z",  // old, but ignored
    }, now), true)
    // camelCase createdAt also works
    assert.equal(isCurrentGovtNotification({
      recordType: "notification", sourcePublishedAt: undefined,
      createdAt: "2026-09-15T12:00:00.000Z",
    }, now), true)
    // snake_case source_published_at also works with created_at fallback
    assert.equal(isCurrentGovtNotification({
      tab: "latest", title: "Recruitment",
      source_published_at: undefined,
      created_at: "2026-08-01T00:00:00.000Z",
    }, now), true)
    // Neither timestamp → not current
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
    }, now), false)
  })

  /* ---------- created_at fallback: edge-case tests (safety review) ---------- */

  await test("source_published_at takes strict precedence over a recent created_at", () => {
    const now = new Date("2026-10-01T00:00:00.000Z")
    // Old real publication date — must be excluded even though created_at is recent
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      sourcePublishedAt: "2024-06-01T00:00:00.000Z",
      created_at: "2026-09-20T00:00:00.000Z",
    }, now), false, "old source_published_at must win over recent created_at")
    // Recent real publication date — must pass even though created_at is old
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      sourcePublishedAt: "2026-09-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
    }, now), true, "recent source_published_at must win over old created_at")
    // Same with snake_case source_published_at
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      source_published_at: "2024-06-01T00:00:00.000Z",
      created_at: "2026-09-20T00:00:00.000Z",
    }, now), false, "snake_case source_published_at must also take precedence")
  })

  await test("future and boundary timestamps are rejected (clock sanity)", () => {
    const now = new Date("2026-10-01T00:00:00.000Z")
    // Future timestamp → age < 0 → excluded
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      created_at: "2027-01-01T00:00:00.000Z",
    }, now), false, "future timestamp must fail (age < 0)")
    // Exactly 365 days ago → at the boundary (age === MAX) → included
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 3600_000).toISOString()
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      created_at: oneYearAgo,
    }, now), true, "exactly 365-day-old should be included (age <= MAX)")
    // One millisecond past the 365-day boundary → excluded
    const justPast = new Date(now.getTime() - 365 * 24 * 3600_000 - 1).toISOString()
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      created_at: justPast,
    }, now), false, "1ms past the 1-year window must be excluded")
  })

  await test("malformed and empty created_at values are safely rejected", () => {
    const now = new Date("2026-10-01T00:00:00.000Z")
    assert.equal(isCurrentGovtNotification({
      recordType: "notification", created_at: "not-a-date",
    }, now), false, "non-date string must be rejected")
    assert.equal(isCurrentGovtNotification({
      recordType: "notification", created_at: "",
    }, now), false, "empty string must be rejected")
    assert.equal(isCurrentGovtNotification({
      recordType: "notification", created_at: "0000-00-00",
    }, now), false, "zero date must be rejected")
    assert.equal(isCurrentGovtNotification({
      recordType: "notification", created_at: "99999",
    }, now), false, "numeric junk must be rejected")
  })

  await test("expiry and status filtering are independent of isCurrentGovtNotification — the function only checks freshness, not status", () => {
    // isCurrentGovtNotification() does NOT check status/review_status/published.
    // Those are enforced by the RLS policy and expireStaleJobs() independently.
    // This test documents that boundary: the function returns true for a row
    // that is fresh by timestamp, even if it would be excluded by other mechanisms.
    const now = new Date("2026-10-01T00:00:00.000Z")
    // A row with status=expired would be excluded by RLS/expireStaleJobs(),
    // but isCurrentGovtNotification only sees the timestamp.
    assert.equal(isCurrentGovtNotification({
      recordType: "notification",
      created_at: "2026-09-15T00:00:00.000Z",
    }, now), true, "freshness gate does not check status — that is RLS/expireStaleJobs()'s job")
    // Verify the actual query-level exclusion is documented in the RLS policy
    const reconcileSql = read("supabase/migrations/20260610000001_govt_jobs_reconcile.sql")
    assert.match(reconcileSql, /status\s*=\s*'active'/, "RLS policy must require status = 'active'")
    assert.match(reconcileSql, /review_status\s*=\s*'approved'/, "RLS policy must require review_status = 'approved'")
    assert.match(reconcileSql, /published\s*=\s*TRUE/i, "RLS policy must require published = TRUE")
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

  /* ---------------- isCurrentGovtNotification(...) call-site safety ---------------- */
  /*
   * 2026-10-25: found while fixing the misleading hub/category/state teaser-count
   * bug (PR #48 validation). `Array.prototype.filter(callback)` invokes
   * `callback(element, index, array)` — THREE arguments. `isCurrentGovtNotification`'s
   * second parameter is `now: Date`, defaulted to `new Date()`. Passed directly as
   * `.filter(isCurrentGovtNotification)`, the array's numeric `index` silently fills
   * that `now` slot (0, 1, 2, ... — none of them `undefined`, so the default never
   * applies), and `now.getTime()` throws `TypeError: now.getTime is not a function`
   * the moment any element reaches that line — i.e. the moment a row is a genuine
   * notification with a real, truthy `sourcePublishedAt`.
   *
   * This was invisible in production only because `source_published_at` has been
   * 0% populated across every active row so far: every row hits the earlier
   * `if (!raw) return false` guard before ever touching `now`. The datesNeedingBackfill()
   * fix (this same validation cycle) makes real dates start landing on real rows —
   * at which point every one of these call sites (govtHubStats.ts, govtJobService.ts
   * x2, govtJobLocal.ts, genuineCounts.ts, govtNavStats.ts) would have started
   * throwing on the government hub, every state/category/qualification page, and
   * the sitemap, turning "empty listings" into 500s. All were fixed to
   * `.filter(j => isCurrentGovtNotification(j))`.
   */
  await test("REGRESSION — reproduces the exact crash: Array.filter(isCurrentGovtNotification) throws once a row has a real date (confirms WHY the bare form is unsafe)", () => {
    const rows = [{ recordType: "notification", tab: "latest", title: "A", sourcePublishedAt: "2026-10-01T00:00:00.000Z" }]
    assert.throws(
      () => rows.filter(isCurrentGovtNotification),
      /now\.getTime is not a function/,
      "Array.filter passes (element, index, array); `index` fills isCurrentGovtNotification's `now` parameter",
    )
    // The safe form — wrapping in an arrow that passes only the element — must not throw.
    assert.doesNotThrow(() => rows.filter(j => isCurrentGovtNotification(j)))
  })

  await test("REGRESSION — no production source file passes isCurrentGovtNotification directly as a bare .filter() callback", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs")
    const unsafe = /\.filter\(isCurrentGovtNotification\)/
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir))) {
        const rel = join(dir, entry)
        if (statSync(join(root, rel)).isDirectory()) { walk(rel); continue }
        if (!/\.(ts|tsx)$/.test(entry) || /\.test\.ts$/.test(entry)) continue
        const lines = read(rel).split("\n")
        lines.forEach((line, i) => {
          const trimmed = line.trim()
          if (unsafe.test(line) && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
            offenders.push(`${rel}:${i + 1}`)
          }
        })
      }
    }
    walk("src/lib")
    walk("src/components")
    assert.deepEqual(offenders, [], `found the unsafe bare-callback pattern (not in a comment) at: ${offenders.join(", ")}`)
  })

  /* --------------------------------- migration --------------------------------- */
  await test("migration adds only the minimum columns, additive + idempotent, source date NOT backfilled", () => {
    const sql = read("supabase/migrations/20260727000001_govt_jobs_record_integrity.sql")
    for (const c of ["record_type", "source_published_at", "content_changed_at", "verified_at", "verified_by"]) {
      assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\b`), c)
    }
    assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i)
    assert.doesNotMatch(sql, /UPDATE[^;]*SET[^;]*source_published_at\s*=/i, "must not invent source_published_at")
    assert.match(read("supabase/rollbacks/20260727000001_govt_jobs_record_integrity.down.sql"), /DROP COLUMN IF EXISTS/)
  })

  console.log(`\ngovt integrity tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
}
main()
