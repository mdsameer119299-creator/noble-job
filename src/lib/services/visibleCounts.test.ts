/**
 * visibleCounts.test.ts — COUNT INTEGRITY: every candidate-facing count comes from the
 * same pipeline as the list it describes (renderable + genuine/eligible FIRST → count →
 * paginate/display). A counter can never promise more jobs than a candidate can open.
 *
 *   npm run test:counts
 *
 * Runs against the default (local inventory) data source with no Supabase configured,
 * which is exactly the production default unless NEXT_PUBLIC_JOB_DATA_SOURCE=supabase.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// `React.cache` exists only in the Next server runtime; a plain tsx process needs an identity stub.
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_JOB_DATA_SOURCE"]) delete process.env[k] // hermetic: default local-inventory mode
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
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

async function main() {
  const { isRenderableJob } = await import("../jobs/renderable")
  const { getJobs } = await import("./jobService")
  const { getWfhJobsPaginated } = await import("./wfhJobService")
  const { getAbroadJobsPaginated } = await import("./abroadJobService")
  const { getVisibleBoardCounts, getVisibleAbroadCountryCounts } = await import("./visibleCounts")
  const { getHeroStats } = await import("./heroStatsService")
  const { getCategoryMarketplaceStats } = await import("./categoryMarketplaceStats")
  const { getGenuineJobCounts } = await import("./genuineCounts")
  const { getPrivateJobsLocal } = await import("./jobLocal")
  const { getWfhJobsPaginatedLocal } = await import("./wfhJobLocal")
  const { getAbroadJobsPaginatedLocal } = await import("./abroadJobLocal")
  const { ABROAD_COUNTRY_TARGETS } = await import("../data/jobInventory")

  const priv = await getJobs({ page: 1, limit: 20 })
  const wfh = await getWfhJobsPaginated({ page: 1, limit: 20 })
  const abroad = await getAbroadJobsPaginated({ page: 1, limit: 20 })
  const boards = await getVisibleBoardCounts()

  test("sanity: the boards have inventory to count (so the equalities below are meaningful)", () => {
    assert.ok(priv.total > 100 && wfh.total > 100 && abroad.total > 100)
  })

  test("board counts === the total of the list each board serves (private / WFH / abroad)", () => {
    assert.equal(boards.private.all, priv.total)
    assert.equal(boards.wfh.all, wfh.total)
    assert.equal(boards.abroad.all, abroad.total)
    assert.equal(boards.total.all, priv.total + wfh.total + abroad.total)
  })

  test("status tabs add up: live + verified + archived === all, on every board", () => {
    for (const c of [boards.private, boards.wfh, boards.abroad]) assert.equal(c.live + c.verified + c.archived, c.all)
  })

  test("everything a list shows is renderable (count then paginate operate on the renderable set only)", () => {
    for (const j of priv.jobs) assert.ok(isRenderableJob(j, "private"), `private ${j.id}`)
    for (const j of wfh.items) assert.ok(isRenderableJob(j, "wfh"), `wfh ${j.id}`)
    for (const j of abroad.items) assert.ok(isRenderableJob(j, "abroad"), `abroad ${j.id}`)
  })

  test("the last page is not short of the count: paging every private page yields exactly `total` jobs", async () => {
    const first = await getJobs({ page: 1, limit: 500 })
    let seen = first.jobs.length
    for (let p = 2; p <= first.totalPages; p++) seen += (await getJobs({ page: p, limit: 500 })).jobs.length
    assert.equal(seen, first.total)
  })

  test("/api/stats catalogJobs === the visible board total (never a raw table count)", async () => {
    const { GET } = await import("../../app/api/stats/route")
    const body = await (await GET()).json()
    assert.equal(body.catalogJobs, boards.total.all)
    assert.equal(body.totalJobs, 0, "no Supabase → no genuine rows → no invented total")
  })

  test("/api/inventory-stats catalog + board numbers === the list pipeline; genuine block is separate", async () => {
    const { GET } = await import("../../app/api/inventory-stats/route")
    const body = await (await GET()).json()
    assert.equal(body.catalog.opportunities, boards.total.all)
    assert.deepEqual(body.private, boards.private)
    assert.deepEqual(body.wfh, boards.wfh)
    assert.deepEqual(body.abroad, boards.abroad)
    assert.equal(body.catalog.liveJobs, boards.total.live)
    const genuine = await getGenuineJobCounts({ govt: true })
    assert.equal(body.genuine.opportunities, genuine.total)
    assert.equal(body.genuine.private + body.genuine.wfh + body.genuine.abroad, 0, "sample inventory is never a genuine count")
  })

  test("/api/jobs/count === the private list's non-archived count (both data modes go through getJobs)", async () => {
    const { GET } = await import("../../app/api/jobs/[[...params]]/route")
    const { NextRequest } = await import("next/server")
    const res = await GET(new NextRequest("http://localhost/api/jobs/count"), { params: Promise.resolve({ params: ["count"] }) } as never)
    const body = await res.json()
    assert.equal(body.count, boards.private.all - boards.private.archived)
  })

  test("abroad country cards === the size of the list each card opens (16 countries add up to the board total)", async () => {
    const cards = await getVisibleAbroadCountryCounts()
    assert.equal(cards.length, ABROAD_COUNTRY_TARGETS.length)
    let sum = 0
    for (const c of cards) {
      const list = await getAbroadJobsPaginated({ country: c.name, page: 1, limit: 1 })
      assert.equal(c.jobs, list.counts.all, c.name)
      sum += c.jobs
    }
    assert.equal(sum, boards.abroad.all)
  })

  test("hero 'Roles to Explore' counters === the board's own count (private / WFH / abroad)", async () => {
    for (const [variant, all] of [["private", boards.private.all], ["wfh", boards.wfh.all], ["abroad", boards.abroad.all]] as const) {
      const hero = await getHeroStats(variant)
      const c = hero.counters.find(x => x.key === "all")
      assert.ok(c, `${variant}: has an 'all' counter`)
      assert.equal(c!.value, all, variant)
    }
  })

  test("hero trust-worded counters: 'Live Openings' exists only when a GENUINE job exists — sample rows never make one", async () => {
    const g = await getGenuineJobCounts()
    assert.equal(g.private + g.wfh + g.abroad, 0)
    for (const v of ["private", "wfh", "abroad"] as const) {
      const hero = await getHeroStats(v)
      assert.ok(!hero.counters.some(c => c.key === "live"), `${v}: no live counter without genuine jobs`)
      for (const c of hero.counters) assert.doesNotMatch(c.label, /verified|featured/i, `${v}: '${c.label}'`)
    }
  })

  test("category cards === the size of the list their link opens (open = live + verified)", async () => {
    const stats = new Map((await getCategoryMarketplaceStats()).map(s => [s.slug, s.vacancies]))
    const open = (c: { live: number; verified: number }) => c.live + c.verified
    assert.equal(stats.get("work-from-home"), open(boards.wfh))
    assert.equal(stats.get("aviation"), open((await getAbroadJobsPaginated({ category: "Aviation", page: 1, limit: 1 })).counts))
    for (const [slug, category] of [["it-software", "IT / Software"], ["banking", "Banking"], ["teaching", "Teaching"], ["engineering", "Engineering"], ["healthcare", "Healthcare"], ["sales-marketing", "Sales & Marketing"], ["hospitality", "Hospitality"], ["blue-collar-jobs", "blue-collar"]] as const) {
      assert.equal(stats.get(slug), open((await getJobs({ category, page: 1, limit: 1 })).counts!), slug)
    }
  })

  test("the admin 'synthetic jobs visible' switch is honoured by counts: hidden → smaller, and count === list", () => {
    const on = getPrivateJobsLocal({ page: 1, limit: 20 }, true)
    const off = getPrivateJobsLocal({ page: 1, limit: 20 }, false)
    assert.equal(off.counts!.all, off.total)
    assert.ok(off.counts!.all < on.counts!.all, "hiding sample rows must lower the count")
    const wOn = getWfhJobsPaginatedLocal({ page: 1, limit: 20 }, true)
    const wOff = getWfhJobsPaginatedLocal({ page: 1, limit: 20 }, false)
    assert.equal(wOff.counts.all, wOff.total)
    assert.ok(wOff.counts.all < wOn.counts.all)
    const aOn = getAbroadJobsPaginatedLocal({ page: 1, limit: 20 }, true)
    const aOff = getAbroadJobsPaginatedLocal({ page: 1, limit: 20 }, false)
    assert.equal(aOff.counts.all, aOff.total)
    assert.ok(aOff.counts.all < aOn.counts.all)
  })

  test("static: no candidate-facing job counter reads a raw job-table count or the un-gated inventory", () => {
    for (const f of [
      "src/lib/services/visibleCounts.ts",
      "src/lib/services/heroStatsService.ts",
      "src/lib/services/categoryMarketplaceStats.ts",
      "src/app/api/stats/route.ts",
      "src/app/api/inventory-stats/route.ts",
      "src/components/home/StatsStrip.tsx",
      "src/components/heroes/CategoryHero.tsx",
      "src/components/abroad/AbroadCountriesStrip.tsx",
      "src/components/wfh/WfhStatsHero.tsx",
    ]) {
      const src = strip(read(f))
      assert.doesNotMatch(src, /from\(\s*["'](jobs|wfh_jobs|abroad_jobs|govt_jobs)["']\s*\)[\s\S]{0,160}count:\s*["']exact["']/, `${f}: raw exact count of a job table`)
      assert.doesNotMatch(src, /\b(PRIVATE|WFH|ABROAD)_INVENTORY\b/, `${f}: reads the un-gated inventory`)
      assert.doesNotMatch(src, /ABROAD_COUNTRY_TARGETS\b[^;]*\.jobs\b/, `${f}: marketing target used as a count`)
    }
    assert.doesNotMatch(strip(read("src/app/api/jobs/[[...params]]/route.ts")), /getPrivateJobsCountLocal/)
  })

  test("no hard-coded job-count marketing numbers in the count surfaces", () => {
    for (const f of ["src/components/home/StatsStrip.tsx", "src/components/heroes/CategoryHero.tsx", "src/lib/services/heroStatsService.ts"]) {
      assert.doesNotMatch(strip(read(f)), /["'`]\s*\d{1,3}(,\d{3})+\+?\s*(jobs|openings|vacancies|roles)/i, f)
    }
  })

  await Promise.all(pending)
  console.log(`\ncount-integrity tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
}

void main()
