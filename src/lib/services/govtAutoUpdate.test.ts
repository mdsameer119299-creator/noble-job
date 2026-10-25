/**
 * govtAutoUpdate.test.ts — ingest_runs status/error aggregation, and (issue
 * #46) the RawNotification -> PersistEntry normalisation that is the LAST
 * step before a DB write: this is what proves `publishedAt` genuinely reaches
 * `sourcePublishedAt` (persist() below just writes that field verbatim to the
 * `source_published_at` column — see its own doc comment), for every adapter
 * fixed in this issue, not just in isolation inside each adapter's own file.
 *
 *   npm run test:ingest-status
 *
 * govtAutoUpdate.ts pulls in supabase-js/next-cache-adjacent config, so this
 * only exercises the pure, exported computeIngestRunStatus() / normalise() —
 * no I/O, no mocking needed, matching this repo's other dependency-free unit
 * tests (persist()'s actual Supabase write is intentionally NOT exercised
 * here or anywhere else in this suite).
 */
import assert from "node:assert/strict"
import { computeIngestRunStatus, normalise, datesNeedingBackfill, hasAdapterBudgetRemaining, type AutoUpdateResult } from "./govtAutoUpdate"
import { planIngestWrites, type ExistingGovtRow } from "./govtIngestPlan"
import type { RawNotification, SourceAdapter } from "../ingest/types"

const adapter = (id: string): SourceAdapter => ({ id, label: id, kind: "html", enabled: true, fetch: async () => [] })
const raw = (over: Partial<RawNotification> = {}): RawNotification => ({
    externalId: "ext-1", title: "Test Notification", org: "Test Org", lastDate: "TBA", tab: "latest", ...over,
})

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

/* ── elapsed-time budget guard: skippedSources accounting (2026-10-25) ── */

test("backward compatibility — existing callers that omit skippedSources entirely are unaffected", () => {
    // Mirrors src/lib/govt/govtIntegrity.test.ts's "healthy"/"dead" calls, which
    // predate this field and must keep compiling and behaving identically.
    const r = computeIngestRunStatus({
          failedSources: ["a"],
          sources: [src({ id: "a", error: "x" })],
          totalPublished: 0,
          totalUnchanged: 40,
    })
    assert.equal(r.status, "partial")
    assert.equal(r.error, "failed: a")
})

test("skipped-only (budget), otherwise progressed → partial, NEVER success", () => {
    const r = computeIngestRunStatus({
          failedSources: [],
          skippedSources: ["jnu", "aai"],
          totalPublished: 10,
          sources: [
                  src({ id: "ok", published: 10 }),
                  src({ id: "jnu", error: "skipped: time budget exceeded (47000ms elapsed, 47000ms budget)" }),
                  src({ id: "aai", error: "skipped: time budget exceeded (47000ms elapsed, 47000ms budget)" }),
                ],
    })
    assert.equal(r.status, "partial")
    assert.equal(r.error, "skipped (budget): jnu, aai")
})

test("skipped AND failed in the same run → both clauses present, separated, neither list double-counts the other", () => {
    const r = computeIngestRunStatus({
          failedSources: ["ibps"],
          skippedSources: ["jnu"],
          totalPublished: 3,
          sources: [
                  src({ id: "ok", published: 3 }),
                  src({ id: "ibps", error: "timeout" }),
                  src({ id: "jnu", error: "skipped: time budget exceeded (50000ms elapsed, 47000ms budget)" }),
                ],
    })
    assert.equal(r.status, "partial")
    assert.equal(r.error, "failed: ibps; skipped (budget): jnu")
})

test("a skipped adapter's placeholder error must never be counted as a WRITE failure", () => {
    // Without the skippedIds exclusion in computeIngestRunStatus, this source's
    // `error` string (set by the budget guard, not by persist()) would land in
    // writeFailedIds and be double-reported inside the "failed: " clause too.
    const r = computeIngestRunStatus({
          failedSources: [],
          skippedSources: ["gpsc"],
          totalPublished: 1,
          sources: [src({ id: "ok", published: 1 }), src({ id: "gpsc", error: "skipped: time budget exceeded (47000ms elapsed, 47000ms budget)" })],
    })
    assert.equal(r.error, "skipped (budget): gpsc")
    assert.doesNotMatch(r.error!, /failed:/)
})

test("CONFIRMED DECISION — skipped-only AND zero progress → error, not success", () => {
    // Budget exhausted before anything ran at all (e.g. misconfigured budget).
    // Treated like the existing all-writes-failed regression test: zero
    // progress must never read as success, regardless of cause.
    const r = computeIngestRunStatus({ failedSources: [], skippedSources: ["a", "b"], totalPublished: 0, sources: [] })
    assert.equal(r.status, "error")
    assert.equal(r.error, "skipped (budget): a, b")
})

test("existing write-failure-only regression (no skips involved) is unchanged", () => {
    const r = computeIngestRunStatus({
          failedSources: [],
          totalPublished: 0,
          sources: [
                  src({ id: "mppsc", fetched: 30, error: "persist upsert failed: restricted" }),
                  src({ id: "uksssc", fetched: 14, error: "persist upsert failed: restricted" }),
                ],
    })
    assert.equal(r.status, "error")
    assert.match(r.error!, /mppsc/)
    assert.match(r.error!, /uksssc/)
    assert.doesNotMatch(r.error!, /skipped/)
})

/* ── hasAdapterBudgetRemaining: the loop's exact stop/continue boundary ── */

test("all adapters fast → elapsed stays well under budget throughout, every check passes", () => {
    const budget = 47_000
    let elapsed = 0
    for (let i = 0; i < 14; i++) {
          assert.ok(hasAdapterBudgetRemaining(elapsed, budget), `adapter ${i} should have budget`)
          elapsed += 500 // each adapter takes ~500ms in this scenario
    }
    assert.ok(elapsed < budget, "sanity: 14 fast adapters never approach the budget")
})

test("budget exhausted partway → later adapters correctly denied, earlier ones correctly allowed", () => {
    const budget = 100
    // Simulates 10 adapters at 11ms each: elapsed at the START of adapter i is 11*i.
    const allowed = Array.from({ length: 10 }, (_, i) => hasAdapterBudgetRemaining(11 * i, budget))
    // 11*0..11*9 = 0,11,...,99 all < 100 → every check in THIS sequence still
    // passes (pins the real arithmetic rather than assuming a round split).
    assert.deepEqual(allowed, Array(10).fill(true))
    // One adapter further (11*10=110) correctly fails.
    assert.equal(hasAdapterBudgetRemaining(110, budget), false)
})

test("a slow adapter already in flight is NOT retroactively stopped — pins the documented limitation", () => {
    const budget = 100
    // Adapter 0 starts at elapsed=0 (allowed — budget is fresh).
    assert.equal(hasAdapterBudgetRemaining(0, budget), true)
    // Adapter 0 turns out to take 300ms (its own worst-case timeout, e.g. jnu's
    // PDF-feed chain) — far more than the entire budget. The boundary check has
    // no way to have prevented this; it only runs BETWEEN adapters.
    const elapsedAfterAdapter0 = 300
    // Adapter 1's check, now evaluated at elapsed=300, correctly denies it —
    // demonstrating the guard still recovers control for every adapter AFTER
    // the slow one, even though it could not bound the slow one itself.
    assert.equal(hasAdapterBudgetRemaining(elapsedAfterAdapter0, budget), false)
})

test("exact boundary: elapsed === budget is NOT allowed (strict <, not <=)", () => {
    assert.equal(hasAdapterBudgetRemaining(100, 100), false)
    assert.equal(hasAdapterBudgetRemaining(99, 100), true)
})

/* ── issue #46: RawNotification.publishedAt -> PersistEntry.sourcePublishedAt ── */

test("a real adapter-supplied publishedAt reaches sourcePublishedAt unchanged (ISO passthrough)", () => {
    const entry = normalise(raw({ publishedAt: "2026-09-12T00:00:00.000Z" }), adapter("employment-news"))
    assert.equal(entry.sourcePublishedAt, "2026-09-12T00:00:00.000Z")
})

test("no publishedAt supplied (e.g. uppsc, ibps — see their adapter files) → sourcePublishedAt stays undefined, never the fetch time", () => {
    const entry = normalise(raw({ publishedAt: undefined }), adapter("uppsc"))
    assert.equal(entry.sourcePublishedAt, undefined)
})

test("a malformed publishedAt is rejected, not silently coerced into 'now'", () => {
    const entry = normalise(raw({ publishedAt: "not-a-date" }), adapter("drdo-rac"))
    assert.equal(entry.sourcePublishedAt, undefined)
})

test("this mapping holds across every adapter id fixed by issue #46", () => {
    for (const id of ["employment-news", "drdo-rac", "aai", "jnu", "delhi-hc", "tnpsc"]) {
          const entry = normalise(raw({ publishedAt: "2026-08-01T00:00:00.000Z" }), adapter(id))
          assert.equal(entry.sourcePublishedAt, "2026-08-01T00:00:00.000Z", id)
    }
})

/* ── 2026-10-25: unchanged-row date-backfill bug ──
 * contentHash() never includes publishedAt, so a row whose title/org/post/
 * vacancies/lastDate/officialUrl/notificationPdf are unchanged since its
 * last (pre-date-extraction) ingestion hashes IDENTICALLY on a later run —
 * planIngestWrites correctly classifies it "unchanged" and skips the
 * upsert. Before this fix, persist()'s date-backfill loop only walked
 * plan.writes, so such a row's source_published_at would NEVER be set no
 * matter how many times ingestion re-ran. datesNeedingBackfill() is the
 * pure fix: it must also walk plan.unchanged. */

test("REGRESSION — a row whose content is unchanged since a pre-date-extraction ingestion is classified 'unchanged' (confirms the root cause, not just the fix)", () => {
    const withoutDate = normalise(raw({ publishedAt: undefined }), adapter("mppsc"))
    const withDate = normalise(raw({ publishedAt: "2026-09-01T00:00:00.000Z" }), adapter("mppsc"))
    // Same RawNotification fields feed contentHash() either way -> identical hash,
    // even though one run has a date and the other doesn't.
    assert.equal(withoutDate.hash, withDate.hash, "contentHash must not depend on publishedAt")

    const existing: ExistingGovtRow[] = [{ id: withDate.job.id, content_hash: withoutDate.hash }]
    const plan = planIngestWrites([{ ...withDate, id: withDate.job.id }], existing)
    assert.equal(plan.writes.length, 0, "row must be classified unchanged, not written")
    assert.equal(plan.unchanged.length, 1)
    assert.equal(plan.unchanged[0].sourcePublishedAt, "2026-09-01T00:00:00.000Z", "the fresh date must still ride along on the unchanged entry")
})

test("REGRESSION — datesNeedingBackfill() recovers an unchanged row's date (this is the actual fix)", () => {
    const withoutDate = normalise(raw({ publishedAt: undefined }), adapter("mppsc"))
    const withDate = normalise(raw({ publishedAt: "2026-09-01T00:00:00.000Z" }), adapter("mppsc"))
    const existing: ExistingGovtRow[] = [{ id: withDate.job.id, content_hash: withoutDate.hash }]
    const plan = planIngestWrites([{ ...withDate, id: withDate.job.id }], existing)

    const candidates = datesNeedingBackfill(plan)
    assert.equal(candidates.length, 1, `expected the unchanged row to still be a backfill candidate, got: ${JSON.stringify(candidates)}`)
    assert.equal(candidates[0].sourcePublishedAt, "2026-09-01T00:00:00.000Z")
})

test("datesNeedingBackfill() still covers genuinely new/changed rows (the pre-existing path)", () => {
    const entry = normalise(raw({ externalId: "brand-new", publishedAt: "2026-09-01T00:00:00.000Z" }), adapter("mppsc"))
    const plan = planIngestWrites([{ ...entry, id: entry.job.id }], [] /* no existing row at all -> isNew */)
    assert.equal(plan.writes.length, 1)
    const candidates = datesNeedingBackfill(plan)
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].sourcePublishedAt, "2026-09-01T00:00:00.000Z")
})

test("datesNeedingBackfill() excludes unchanged AND written rows that have no date at all (never a false 'needs backfill')", () => {
    const noDate1 = normalise(raw({ externalId: "a", publishedAt: undefined }), adapter("uppsc"))
    const noDate2 = normalise(raw({ externalId: "b", publishedAt: undefined }), adapter("ibps"))
    const existing: ExistingGovtRow[] = [{ id: noDate1.job.id, content_hash: noDate1.hash }] // "a" unchanged, "b" new
    const plan = planIngestWrites(
          [{ ...noDate1, id: noDate1.job.id }, { ...noDate2, id: noDate2.job.id }],
          existing,
        )
    assert.equal(datesNeedingBackfill(plan).length, 0, "neither entry has a date; none should be a backfill candidate")
})

/* ── 2026-10-25 (item 1 follow-up): additional edge cases for datesNeedingBackfill() ── */

test("datesNeedingBackfill() combines unchanged-with-date AND written-with-date candidates from the SAME run, ignoring a dateless unchanged row alongside them", () => {
    // "stale" = unchanged-since-before-date-extraction, now backfill-eligible (the core bug).
    const staleWithoutDate = normalise(raw({ externalId: "stale", publishedAt: undefined }), adapter("mppsc"))
    const staleWithDate = normalise(raw({ externalId: "stale", publishedAt: "2026-09-01T00:00:00.000Z" }), adapter("mppsc"))
    // "fresh" = brand-new row this run, also carries a date.
    const fresh = normalise(raw({ externalId: "fresh", publishedAt: "2026-09-15T00:00:00.000Z" }), adapter("hpsc"))
    // "noise" = unchanged, but genuinely never had a date (e.g. ibps/uppsc) — must not appear.
    const noise = normalise(raw({ externalId: "noise", publishedAt: undefined }), adapter("uppsc"))

    const existing: ExistingGovtRow[] = [
          { id: staleWithDate.job.id, content_hash: staleWithoutDate.hash },
          { id: noise.job.id, content_hash: noise.hash },
        ]
    const plan = planIngestWrites(
          [
                  { ...staleWithDate, id: staleWithDate.job.id },
                  { ...fresh, id: fresh.job.id },
                  { ...noise, id: noise.job.id },
                ],
          existing,
        )
    assert.equal(plan.unchanged.length, 2, "both stale and noise are unchanged; fresh is a write")
    assert.equal(plan.writes.length, 1)

    const candidates = datesNeedingBackfill(plan)
    const ids = candidates.map(c => c.job.id).sort()
    assert.deepEqual(ids, [fresh.job.id, staleWithDate.job.id].sort(), `expected exactly the two dated rows (one unchanged, one written), got: ${JSON.stringify(ids)}`)
})

test("datesNeedingBackfill() covers an UPDATED (changed, not brand-new) row — not just a fresh insert", () => {
    const before = normalise(raw({ externalId: "upd", title: "Old Title", publishedAt: undefined }), adapter("mppsc"))
    const after = normalise(raw({ externalId: "upd", title: "New Title (vacancy count revised)", publishedAt: "2026-09-20T00:00:00.000Z" }), adapter("mppsc"))
    assert.notEqual(before.hash, after.hash, "the title change must actually change the hash, or this isn't testing the update path")

    const existing: ExistingGovtRow[] = [{ id: after.job.id, content_hash: before.hash }]
    const plan = planIngestWrites([{ ...after, id: after.job.id }], existing)
    assert.equal(plan.writes.length, 1)
    assert.equal(plan.writes[0].isNew, false, "this must be classified as an update, not an insert, to exercise the distinct path")

    const candidates = datesNeedingBackfill(plan)
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].sourcePublishedAt, "2026-09-20T00:00:00.000Z")
})

test("datesNeedingBackfill() treats an empty-string sourcePublishedAt as absent (defensive — normalise()/parseRealDate() should never produce one, but the filter itself must not be fooled by falsy-but-truthy-looking values)", () => {
    const entry = normalise(raw({ externalId: "defensive", publishedAt: "2026-09-01T00:00:00.000Z" }), adapter("mppsc"))
    const corrupted = { ...entry, id: entry.job.id, sourcePublishedAt: "" }
    const plan = { writes: [], unchanged: [corrupted] }
    assert.equal(datesNeedingBackfill(plan).length, 0, "an empty-string sourcePublishedAt must not be treated as a real date")
})

console.log(`\ningest-run status tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
