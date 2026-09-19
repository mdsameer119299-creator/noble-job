/**
 * gateCoverage.test.ts — the NO-EMPTY-JOB invariant, enforced structurally.
 *
 *   npm run test:gate-coverage
 *
 * Invariant: a job that fails the central gate (src/lib/jobs/renderable.ts) has
 * no candidate-facing card, no count, no related link, no sitemap entry, no JobPosting,
 * and its direct detail URL is a 404. The database record is never deleted.
 *
 * This suite (1) enumerates EVERY module that reads a job table and requires each to be
 * either gated or an explicitly-reviewed internal/admin path — a new, unreviewed reader
 * fails the build until it is classified; (2) checks every public job API route goes
 * through the gated services; (3) exercises saved jobs and the sitemap data-source switch
 * behaviourally.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_JOB_DATA_SOURCE"]) delete process.env[k]
// `React.cache` exists only in the Next server runtime; a plain tsx process needs an identity stub.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const R = require("react") as { cache?: unknown }
if (!R.cache) R.cache = (fn: unknown) => fn

let passed = 0
let failed = 0
const pending: Promise<unknown>[] = []
function test(name: string, fn: () => void | Promise<void>) {
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(() => { passed++; console.log(`  PASS  ${name}`) })
      .catch(err => { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }),
  )
}
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(root, dir))) {
    const rel = `${dir}/${e}`
    const st = statSync(join(root, rel))
    if (st.isDirectory()) { if (e !== "node_modules" && e !== ".next") walk(rel, out) }
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(rel)
  }
  return out
}

/* ─────────────── every reader of a job table is classified ─────────────── */

/** Reads job tables AND applies the gate before anything reaches a candidate. */
const GATED_READERS: Record<string, RegExp> = {
  "src/lib/services/jobService.ts": /filterRenderable|renderableOrNull/,
  "src/lib/services/wfhJobService.ts": /filterRenderable|renderableOrNull/,
  "src/lib/services/abroadJobService.ts": /filterRenderable|renderableOrNull/,
  "src/lib/services/featuredJobs.ts": /filterActionable/,
  "src/lib/services/govtStatsSource.ts": /isServableGovtJob|servable/i,
  "src/app/api/candidate/[[...params]]/route.ts": /filterActionable/,
  "src/services/jobAlertDispatcher.ts": /isActionableJob/,
}
/** Reviewed: NOT candidate-facing job exposure (admin / employer-owner / ingestion / analytics / lookups that return no job card). */
const INTERNAL_READERS: Record<string, string> = {
  "src/app/api/admin/[[...params]]/route.ts": "admin console (admin-only)",
  "src/lib/services/adminService.ts": "admin moderation writes",
  "src/lib/services/adminAnalytics.ts": "admin dashboard aggregates",
  "src/app/api/applications/[[...params]]/route.ts": "reads employer_id/title/category of the job being applied to; returns no job card",
  "src/app/api/candidate/resume-score/route.ts": "reads one description to score a resume; returns a score, no job card",
  "src/lib/services/govtAutoUpdate.ts": "ingestion writer",
  "src/lib/services/govtCoverage.ts": "ingestion coverage report",
  "src/lib/services/govtSeedService.ts": "seed writer",
}
const TABLE_LITERAL = /\.from\(\s*["'`](jobs|wfh_jobs|abroad_jobs|govt_jobs)["'`]\s*\)/

test("every module that reads a job table is either gated or an explicitly reviewed internal path", () => {
  const readers = walk("src").filter(f => TABLE_LITERAL.test(strip(read(f))))
  const known = new Set([...Object.keys(GATED_READERS), ...Object.keys(INTERNAL_READERS)])
  const unknown = readers.filter(f => !known.has(f))
  assert.deepEqual(unknown, [], `unreviewed job-table reader(s): ${unknown.join(", ")} — gate them (src/lib/jobs/renderable.ts) or classify them here`)
  for (const f of known) assert.ok(readers.includes(f), `${f} is listed but no longer reads a job table — remove it from the list`)
})
test("every gated reader really applies the gate", () => {
  for (const [f, re] of Object.entries(GATED_READERS)) assert.match(strip(read(f)), re, f)
})
test("employer-facing routes read only the OWNER's rows (eq employer_id) — never a public list", () => {
  const src = strip(read("src/app/api/employer/[[...params]]/route.ts"))
  assert.match(src, /\.eq\("employer_id", eid\)/)
  assert.doesNotMatch(src, /getJobs\(|getWfhJobs\(|getAbroadJobs\(/)
})
test("the sitemap reads rows through the sitemap policy (genuine + open + renderable + valid id)", () => {
  assert.match(strip(read("src/lib/seo/sitemapJobs.ts")), /TABLE\[board\]/)
  const sm = strip(read("src/app/sitemap.ts"))
  assert.match(sm, /jobRowsToSitemapEntries|sitemapJobs|sitemapPolicy/)
  assert.match(strip(read("src/lib/seo/sitemapPolicy.ts")), /isRenderableJob|checkJobRecord|isValidJobId/)
})

/* ─────────────── public job APIs go through the gated services ─────────────── */

test("public job API routes never read a job table directly", () => {
  for (const f of walk("src/app/api").filter(x => /\/(jobs|wfh-jobs|abroad-jobs|govt-jobs|external|stats|inventory-stats|saved-jobs|bookmarks|alerts)\//.test(x))) {
    assert.doesNotMatch(strip(read(f)), TABLE_LITERAL, f)
  }
})
test("/api/wfh-jobs, /api/abroad-jobs, /api/jobs, /api/govt-jobs delegate to the list services", () => {
  const expect: Array<[string, RegExp]> = [
    ["src/app/api/wfh-jobs/[[...params]]/route.ts", /wfhJobService|getWfhJobs/],
    ["src/app/api/abroad-jobs/[[...params]]/route.ts", /abroadJobService|getAbroadJobs/],
    ["src/app/api/jobs/[[...params]]/route.ts", /jobService|getJobs/],
    ["src/app/api/govt-jobs/[[...params]]/route.ts", /govt/i],
  ]
  for (const [f, re] of expect) assert.match(strip(read(f)), re, f)
})
test("client hooks re-apply the gate to whatever the API returns", () => {
  assert.match(read("src/hooks/useJobs.ts"), /toListingJobs/)
  assert.match(read("src/hooks/useWfhJobs.ts"), /toRenderableWfhJobs/)
  assert.match(read("src/hooks/useAbroadJobs.ts"), /toRenderableAbroadJobs/)
  assert.match(read("src/hooks/useGovtJobs.ts"), /toRenderableGovtJobs/)
})

/* ─────────────── links never point at a page that would 404 ─────────────── */

test("home cards, recommendations and the sitemap all use the ONE data-source switch the detail pages use", () => {
  assert.match(strip(read("src/lib/services/featuredJobs.ts")), /useLocalInventoryOnly\(\)/)
  assert.doesNotMatch(strip(read("src/lib/services/featuredJobs.ts")), /isSupabaseConfigured/)
  assert.match(strip(read("src/app/api/candidate/[[...params]]/route.ts")), /useLocalInventoryOnly\(\)/)
  assert.match(strip(read("src/lib/seo/sitemapJobs.ts")), /!useLocalInventoryOnly\(\)/)
})
test("sitemap job rows: none while detail pages serve the local inventory (even with Supabase configured); rows only in database mode", async () => {
  const { readSitemapJobRows, detailPagesServeDatabase } = await import("../seo/sitemapJobs")
  const { getGenuineJobCounts } = await import("../services/genuineCounts")
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-test"
  try {
    delete process.env.NEXT_PUBLIC_JOB_DATA_SOURCE
    assert.equal(detailPagesServeDatabase(), false)
    for (const b of ["private", "wfh", "abroad"] as const) assert.deepEqual(await readSitemapJobRows(b), [], b)
    const g = await getGenuineJobCounts()
    assert.equal(g.private + g.wfh + g.abroad, 0, "no genuine 'live' count for jobs whose pages would 404")
    process.env.NEXT_PUBLIC_JOB_DATA_SOURCE = "supabase"
    assert.equal(detailPagesServeDatabase(), true)
  } finally {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_JOB_DATA_SOURCE
  }
})

/* ─────────────── saved jobs ─────────────── */

test("saved jobs: a reference resolves only to a renderable job — bogus ids, unknown boards and missing jobs are dropped", async () => {
  const { resolveSavedJob, normalizeSavedBoard } = await import("../services/savedJobsResolver")
  const { renderablePrivateInventory } = await import("../data/jobInventory")
  const real = renderablePrivateInventory()[0]
  const ok = await resolveSavedJob(real.id, "private")
  assert.ok(ok)
  assert.equal(ok!.title, real.title)
  assert.ok(ok!.company)
  for (const bad of [undefined, null, "", "  ", "undefined", "null", "../etc/passwd", "a/b", 42, {}]) {
    assert.equal(await resolveSavedJob(bad, "private"), null, String(bad))
  }
  assert.equal(await resolveSavedJob("no-such-job-id-123", "private"), null)
  assert.equal(await resolveSavedJob(real.id, "made-up-board"), null)
  assert.equal(await resolveSavedJob(real.id, "wfh"), null, "a private id is not a WFH job")
  assert.equal(normalizeSavedBoard(undefined), "private")
  assert.equal(normalizeSavedBoard("GOVT"), "govt")
  assert.equal(normalizeSavedBoard("x"), null)
})
test("saved jobs API: GET lists only resolvable jobs (title shown, never 'View job <id>'); POST refuses an unresolvable job; rows are not deleted", () => {
  const route = strip(read("src/app/api/saved-jobs/[[...params]]/route.ts"))
  assert.match(route, /resolveSavedJob\(/)
  assert.match(route, /status:\s*404/)
  assert.doesNotMatch(route, /\.delete\(/, "unresolvable references are hidden, not deleted")
  const tab = strip(read("src/components/candidate/SavedJobsTab.tsx"))
  assert.doesNotMatch(tab, /View job \{/)
  assert.match(tab, /isRealDisplayValue\(s\?\.title\)/)
})

void (async () => {
  await Promise.all(pending)
  console.log(`\ngate-coverage tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
  void relative
})()
