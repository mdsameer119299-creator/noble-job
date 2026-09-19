/**
 * jobExpiryPlan.test.ts — Phase 1 job expiry / freshness lifecycle.
 *
 *   npm run test:seo-phase1
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  buildCloseUpdate,
  buildConfirmOpenUpdate,
  effectiveReviewDue,
  planLifecycleActions,
  type LifecycleRow,
} from "./jobExpiryPlan"
import { jobAutoCloseGraceDays, jobReviewIntervalDays } from "../config/jobLifecycleConfig"
import { EMPLOYER_PROTECTED_JOB_FIELDS, stripProtectedJobFields } from "./jobLifecycle"
import { isOpen, isIndexable } from "../jobs/provenance"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

const NOW = new Date("2026-09-19T00:00:00.000Z")
const cfg = { reviewIntervalDays: 45 }
const row = (over: Partial<LifecycleRow> = {}): LifecycleRow => ({ id: "j1", status: "active", posted_at: "2026-09-01T00:00:00Z", ...over })

test("a fresh job with no dates set: schedules review = posted_at + interval; nothing else", () => {
  const a = planLifecycleActions([row()], NOW, cfg)
  assert.deepEqual(a, [{ kind: "schedule_review", id: "j1", reviewDueAt: "2026-10-16T00:00:00.000Z" }])
})
test("review date counts from the last CONFIRMATION when there is one", () => {
  const r = row({ last_confirmed_open_at: "2026-09-10T00:00:00Z" })
  assert.equal(effectiveReviewDue(r, cfg), "2026-10-25T00:00:00.000Z")
})
test("a stored review_due_at is respected and not re-scheduled", () => {
  const a = planLifecycleActions([row({ review_due_at: "2026-11-01T00:00:00Z" })], NOW, cfg)
  assert.deepEqual(a, [])
})
test("review due (past) → 'review_due' report; NOT closed by default", () => {
  const a = planLifecycleActions([row({ posted_at: "2026-06-01T00:00:00Z", review_due_at: "2026-07-16T00:00:00Z" })], NOW, cfg)
  assert.deepEqual(a.map(x => x.kind), ["review_due"])
})
test("silence alone does not close a job unless auto-close is opted into", () => {
  const stale = row({ review_due_at: "2026-01-01T00:00:00Z" })
  assert.equal(planLifecycleActions([stale], NOW, cfg).some(a => a.kind === "close"), false)
  const withGrace = planLifecycleActions([stale], NOW, { ...cfg, autoCloseGraceDays: 14 })
  assert.deepEqual(withGrace, [{ kind: "close", id: "j1", reason: "unconfirmed_past_grace" }])
  const insideGrace = planLifecycleActions([row({ review_due_at: "2026-09-10T00:00:00Z" })], NOW, { ...cfg, autoCloseGraceDays: 14 })
  assert.deepEqual(insideGrace.map(a => a.kind), ["review_due"])
})
test("the employer's REAL deadline passing closes the job (regardless of review date)", () => {
  const a = planLifecycleActions([row({ application_deadline: "2026-09-01T00:00:00Z", review_due_at: "2099-01-01T00:00:00Z" })], NOW, cfg)
  assert.deepEqual(a, [{ kind: "close", id: "j1", reason: "deadline_passed" }])
})
test("a FUTURE deadline does not close; a junk deadline is ignored (not invented)", () => {
  assert.equal(planLifecycleActions([row({ application_deadline: "2026-12-31T00:00:00Z", review_due_at: "2026-11-01T00:00:00Z" })], NOW, cfg).length, 0)
  const junk = planLifecycleActions([row({ application_deadline: "soon", review_due_at: "2026-11-01T00:00:00Z" })], NOW, cfg)
  assert.equal(junk.some(a => a.kind === "close"), false)
})
test("non-active rows (closed / paused / pending / draft) are never touched", () => {
  for (const status of ["closed", "paused", "pending", "draft", "rejected", "archived"]) {
    assert.deepEqual(planLifecycleActions([row({ status, application_deadline: "2020-01-01T00:00:00Z" })], NOW, cfg), [], status)
  }
})
test("a row with no real date to count from is left alone (we do not guess)", () => {
  assert.deepEqual(planLifecycleActions([row({ posted_at: null })], NOW, cfg), [])
  assert.equal(effectiveReviewDue(row({ posted_at: "yesterday" }), cfg), undefined)
})
test("confirming 'still open' pushes review out; closing only sets status + closed_at", () => {
  const c = buildConfirmOpenUpdate(NOW, cfg)
  assert.equal(c.last_confirmed_open_at, "2026-09-19T00:00:00.000Z")
  assert.equal(c.review_due_at, "2026-11-03T00:00:00.000Z")
  assert.ok(!("application_deadline" in c), "confirmation must not touch the employer deadline")
  assert.deepEqual(buildCloseUpdate(NOW), { status: "closed", closed_at: "2026-09-19T00:00:00.000Z" })
})
test("lifecycle: closed → drops out of the open/indexable gate (JobPosting + sitemap disappear)", () => {
  const genuine = { id: "j", provenance: "EMPLOYER", employer_id: "e", is_verified: true, status: "active" }
  assert.equal(isIndexable(genuine), true)
  assert.equal(isOpen({ ...genuine, ...buildCloseUpdate(NOW) }), false)
  assert.equal(isIndexable({ ...genuine, ...buildCloseUpdate(NOW) }), false)
})
test("config: review interval default 45, auto-close default OFF, both overridable", () => {
  assert.equal(jobReviewIntervalDays({}), 45)
  assert.equal(jobReviewIntervalDays({ JOB_REVIEW_INTERVAL_DAYS: "30" }), 30)
  assert.equal(jobReviewIntervalDays({ JOB_REVIEW_INTERVAL_DAYS: "" }), 45)
  assert.equal(jobAutoCloseGraceDays({}), undefined)
  assert.equal(jobAutoCloseGraceDays({ JOB_AUTO_CLOSE_GRACE_DAYS: "" }), undefined)
  assert.equal(jobAutoCloseGraceDays({ JOB_AUTO_CLOSE_GRACE_DAYS: "7" }), 7)
})
test("employers cannot set NobleJob's internal lifecycle bookkeeping, but CAN set their own deadline", () => {
  for (const f of ["review_due_at", "last_confirmed_open_at", "closed_at"]) {
    assert.ok((EMPLOYER_PROTECTED_JOB_FIELDS as readonly string[]).includes(f), f)
  }
  const out = stripProtectedJobFields({ title: "t", application_deadline: "2026-12-31", review_due_at: "x", closed_at: "y", last_confirmed_open_at: "z" })
  assert.deepEqual(out, { title: "t", application_deadline: "2026-12-31" })
})
test("scheduling uses GitHub Actions on the real (Hostinger) architecture — no Vercel cron", () => {
  const wf = read(".github/workflows/job-lifecycle.yml")
  assert.match(wf, /schedule:/); assert.match(wf, /run-job-lifecycle\.ts/)
  const vercel = read("vercel.json")
  assert.doesNotMatch(vercel, /job-lifecycle|run-job-lifecycle/)
})
test("migration: additive/idempotent; NO backfill that invents a deadline", () => {
  const sql = read("supabase/migrations/20260727000002_job_lifecycle_foundation.sql")
  for (const c of ["application_deadline", "review_due_at", "last_confirmed_open_at", "closed_at"]) assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\b`))
  assert.doesNotMatch(sql, /UPDATE\s+public\./i)
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM/i)
})
test("the runner closes only rows that are STILL active (race-safe) and never writes application_deadline", () => {
  const run = read("scripts/run-job-lifecycle.ts")
  assert.match(run, /\.eq\("status", "active"\)/)
  assert.doesNotMatch(run, /update\(\{[^}]*application_deadline/)
})

console.log(`\njob lifecycle tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
