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
import { computeIngestRunStatus, normalise, datesNeedingBackfill, type AutoUpdateResult } from "./govtAutoUpdate"
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

console.log(`\ningest-run status tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
