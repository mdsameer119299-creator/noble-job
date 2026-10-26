/**
 * abroadCountryCounts.test.ts — the Abroad country cards are COUNTED from one shared read, and each card's
 * number equals the size of the list it opens.
 *
 *   npm run test:abroad-counts
 *
 * Hermetic: the Supabase server client and the admin-settings service are replaced by in-memory fakes
 * (module interception), so nothing here opens a network connection, reads or writes a real database, or
 * needs credentials. The fake models only what the Abroad list uses from PostgREST:
 *   .from("abroad_jobs").select(..).eq("status","active").order(..)
 * and RECORDS every ilike() so the test can prove the country filter is no longer pushed down to SQL.
 *
 * What is proven:
 *   • for every country card (and for alias / case / lookalike probes) count === getAbroadJobsPaginated({country}).total
 *     in production-DB mode, with synthetic rows hidden and visible, in DB-error / DB-throw / unconfigured
 *     fallbacks, and in local-inventory mode;
 *   • COUNTRY IDENTITY, not just parity: the UK card counts "United Kingdom" / "U.K." rows and NOT Ukraine;
 *     the Oman card counts Oman and NOT Romania; the UAE card counts "United Arab Emirates" and "Dubai, UAE";
 *     the list each card opens contains exactly those rows;
 *   • rows that are not active, not renderable, or synthetic-while-hidden are never counted, exactly as in the list;
 *   • the same alias rules hold in local-inventory mode;
 *   • counting 16 countries — and listing any country — costs ONE `abroad_jobs` read (country is not part of
 *     the read), and the list + counts + hero-style callers of one request share it;
 *   • failures yield 0 (never a marketing target) and never throw.
 */
import assert from "node:assert/strict"
import { register } from "node:module"
import { pathToFileURL } from "node:url"

const env = process.env as Record<string, string | undefined>
delete env.NEXT_PUBLIC_JOB_DATA_SOURCE
env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.invalid" // never contacted: the client is a fake
env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key"

// ── per-request memo, standing in for React's `cache()` (absent in a bare Node process) ─────────────
const memos: Map<string, unknown>[] = []
function resetRequest() { for (const m of memos) m.clear() }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const R = require("react") as { cache?: unknown }
R.cache = <A extends unknown[], T>(fn: (...a: A) => T) => {
  const memo = new Map<string, unknown>()
  memos.push(memo)
  return (...a: A): T => {
    const key = a.map(x => (x === undefined ? "\u0000u" : JSON.stringify(x))).join("\u0001")
    if (!memo.has(key)) memo.set(key, fn(...a))
    return memo.get(key) as T
  }
}

// ── fakes ───────────────────────────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>
let rows: Row[] = []
let settings: Record<string, string> = {}
let dbMode: "ok" | "error" | "throw" = "ok"
let reads: string[] = []
let ilikes: string[] = []
const abroadReads = () => reads.filter(t => t === "abroad_jobs").length

function queryBuilder(table: string) {
  const preds: Array<(r: Row) => boolean> = []
  const b = {
    select: () => b,
    eq: (col: string, v: unknown) => { preds.push(r => r[col] === v); return b },
    ilike: (col: string, pattern: string) => {
      ilikes.push(`${table}.${col}`)
      const needle = pattern.replace(/^%/, "").replace(/%$/, "").toLowerCase()
      preds.push(r => String(r[col] ?? "").toLowerCase().includes(needle))
      return b
    },
    or: () => { throw new Error("unexpected .or() — this test never filters by q") },
    order: () => b,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(
        dbMode === "error"
          ? { data: null, error: { message: "simulated database error" } }
          : { data: table === "abroad_jobs" ? rows.filter(r => preds.every(p => p(r))) : [], error: null },
      ).then(resolve, reject),
  }
  return b
}
const fakeServer = {
  createClient: async () => ({
    from(table: string) {
      reads.push(table)
      if (dbMode === "throw") throw new Error("simulated connection failure")
      return queryBuilder(table)
    },
  }),
}
const fakeSiteContent = { getAdminSettings: async () => settings }

// Two import styles reach these modules, and each needs its own seam:
//  • STATIC `import` (syntheticVisibility → siteContentService) is a CommonJS require → Module._load;
//  • the service's lazy `await import("@/lib/supabase/server")` is a native dynamic import → an ESM loader hook.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as { _load: (...a: unknown[]) => unknown }
const realLoad = Module._load
const FAKES: Record<string, unknown> = {
  "@/lib/supabase/server": fakeServer,
  "@/lib/services/siteContentService": fakeSiteContent,
}
Module._load = function (this: unknown, request: unknown, ...rest: unknown[]) {
  if (typeof request === "string" && request in FAKES) return FAKES[request]
  return realLoad.call(this, request, ...rest)
}
;(globalThis as Record<string, unknown>).__noblejobFakeSupabaseServer = fakeServer
const ESM_HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/supabase/server") return { url: "noblejob-test-fake:supabase-server", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "noblejob-test-fake:supabase-server") {
    return { format: "module", shortCircuit: true, source: "export const createClient = (...a) => globalThis.__noblejobFakeSupabaseServer.createClient(...a);" };
  }
  return nextLoad(url, context);
}`
register(`data:text/javascript,${encodeURIComponent(ESM_HOOKS)}`, pathToFileURL(`${process.cwd()}/`))

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────
let n = 0
function dbRow(country: string, over: Row = {}): Row {
  n++
  return {
    id: `himalayas:${String(n).padStart(40, "0")}`, title: `Remote Engineer ${n}`, company: `Company ${n}`, logo: "CO",
    country, location: `${country} (remote)`, type: "Full-time", salary: "", experience: "", category: "Engineering",
    description: "Design, build and ship distributed systems with a remote-first product team.",
    apply_url: `https://himalayas.app/companies/company-${n}/jobs/engineer-${n}`, skills: [],
    status: "active", posted_at: "2026-10-20T00:00:00Z", jobStatus: "LIVE_JOB", provenance: "AGGREGATED", employer_id: null, ...over,
  }
}
function seed(): Row[] {
  return [
    dbRow("UAE"), dbRow("UAE"), dbRow("UAE"), dbRow("uae"), dbRow("United Arab Emirates"), dbRow("Dubai, UAE"),
    dbRow("Saudi Arabia"), dbRow("Saudi Arabia"),
    dbRow("Qatar"),
    dbRow("Qatar", { description: "" }),                         // not renderable → in neither list nor count
    dbRow("Qatar", { status: "closed" }),                        // not active → in neither list nor count
    dbRow("Romania"), dbRow("Oman"),                             // lookalikes: Oman must not pick up Romania
    dbRow("United Kingdom"), dbRow("United Kingdom"), dbRow("U.K."), dbRow("Ukraine"), // UK must not pick up Ukraine
    dbRow("United States"),
    dbRow("Canada"), dbRow("Canada"), dbRow("CANADA"),
    dbRow("Germany"), dbRow("Singapore"),
    // A demo row: hidden unless the admin switch is on.
    dbRow("UAE", { id: "live-abroad-uae-1", provenance: "SYNTHETIC", apply_url: "", source: "Live feed" }),
  ]
}

// ── tiny sequential harness ─────────────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`)
  }
}
function scenario(opts: { production?: boolean; configured?: boolean; dbSource?: boolean; db?: "ok" | "error" | "throw"; synthetic?: boolean; data?: Row[] }) {
  ;(env as Record<string, string | undefined>).NODE_ENV = opts.production ? "production" : "development"
  if (opts.configured === false) { delete env.NEXT_PUBLIC_SUPABASE_URL; delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
  else { env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.invalid"; env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key" }
  if (opts.dbSource) env.NEXT_PUBLIC_JOB_DATA_SOURCE = "supabase"; else delete env.NEXT_PUBLIC_JOB_DATA_SOURCE
  dbMode = opts.db ?? "ok"
  settings = opts.synthetic ? { synthetic_jobs_visible: "true" } : {}
  rows = opts.data ?? seed()
  reads = []
  ilikes = []
  resetRequest()
}

async function main() {
  const { getAbroadCountryCounts, getAbroadJobsPaginated, getAbroadJobs } = await import("./abroadJobService")
  const { getVisibleAbroadCountryCounts, getAbroadVisibleCounts } = await import("./visibleCounts")
  const { ABROAD_COUNTRY_TARGETS } = await import("../data/jobInventory")

  const names = ABROAD_COUNTRY_TARGETS.map(c => c.country)
  // Extra probes: other casings, long-form / alias spellings, lookalike countries, fragments, a name no row has.
  const probes = [...names, "uae", "United Arab Emirates", "United Kingdom", "uk", "oman", "ROMANIA", "Ukraine", "USA", "kingdom", "Emirat", "Atlantis"]

  /** The list each card opens, asked the way the page asks (page 1 of 20) — the ground truth for the count. */
  async function assertCountsEqualLists(label: string, expectNonZero = false) {
    const counts = await getAbroadCountryCounts(probes)
    let sum = 0
    for (const c of probes) {
      const list = await getAbroadJobsPaginated({ country: c, page: 1, limit: 20 })
      assert.equal(counts[c], list.total, `${label}: ${c} — card ${counts[c]} vs list ${list.total}`)
      assert.equal(counts[c], list.counts.all, `${label}: ${c} — card vs list counts.all`)
      sum += counts[c]
    }
    if (expectNonZero) assert.ok(sum > 0, `${label}: scenario must actually have jobs to count`)
    return counts
  }

  // ── production database mode ─────────────────────────────────────────────────────────────────────
  await test("production DB, synthetic hidden: every card === the size of the list it opens (alias, case and lookalike probes included)", async () => {
    scenario({ production: true })
    const c = await assertCountsEqualLists("prod", true)
    // Explicit numbers, so a bug that breaks list AND count the same way still fails:
    assert.equal(c.UAE, 6, "UAE×3 + uae + 'United Arab Emirates' + 'Dubai, UAE'; the demo row is hidden")
    assert.equal(c["United Arab Emirates"], 6, "the long form is the same card")
    assert.equal(c["Saudi Arabia"], 2)
    assert.equal(c.Qatar, 1, "the non-renderable and the closed Qatar rows are excluded exactly as in the list")
    assert.equal(c.Canada, 3, "case-insensitive: CANADA counts for Canada")
    assert.equal(c.Oman, 1, "Oman counts Oman only — Romania is not Oman")
    assert.equal(c.ROMANIA, 1, "…and Romania is its own country")
    assert.equal(c.UK, 3, "UK counts 'United Kingdom'×2 + 'U.K.' — and not Ukraine")
    assert.equal(c["United Kingdom"], 3)
    assert.equal(c.uk, 3)
    assert.equal(c.Ukraine, 1)
    assert.equal(c.USA, 1, "USA ↔ 'United States'")
    assert.equal(c.Germany, 1)
    assert.equal(c.Bahrain, 0)
    assert.equal(c.uae, c.UAE, "country names are matched case-insensitively")
    assert.equal(c.kingdom, 0, "a fragment of a country name is not a country")
    assert.equal(c.Emirat, 0)
    assert.equal(c.Atlantis, 0)
  })

  await test("COUNTRY IDENTITY: each card's LIST contains exactly its own country's rows — UK never lists Ukraine, Oman never lists Romania", async () => {
    scenario({ production: true })
    const countriesOf = async (c: string) => (await getAbroadJobs({ country: c })).map(j => j.country).sort()
    assert.deepEqual(await countriesOf("UK"), ["U.K.", "United Kingdom", "United Kingdom"])
    assert.deepEqual(await countriesOf("Oman"), ["Oman"])
    assert.deepEqual(await countriesOf("UAE"), ["Dubai, UAE", "UAE", "UAE", "UAE", "United Arab Emirates", "uae"])
    assert.deepEqual(await countriesOf("Ukraine"), ["Ukraine"])
    assert.deepEqual(await countriesOf("Romania"), ["Romania"])
    // And the same set via the paginated service the page calls.
    const page = await getAbroadJobsPaginated({ country: "UK", page: 1, limit: 20 })
    assert.equal(page.total, 3)
    assert.ok(page.items.every(j => !/ukraine/i.test(j.country)))
  })

  await test("the country filter is NOT pushed down to SQL (no ILIKE on country) — the list and the counts cannot diverge on alias handling", async () => {
    scenario({ production: true })
    await getAbroadJobsPaginated({ country: "UK", page: 1, limit: 20 })
    await getAbroadCountryCounts(names)
    assert.deepEqual(ilikes, [], "no ilike() was issued at all")
  })

  await test("production DB, synthetic VISIBLE (admin switch on): the demo row is counted by the card and the list alike", async () => {
    scenario({ production: true, synthetic: true })
    const c = await assertCountsEqualLists("prod+synthetic", true)
    assert.equal(c.UAE, 7, "six real UAE rows + the demo row")
  })

  await test("non-production with the Supabase data source: same rules, card === list", async () => {
    scenario({ dbSource: true })
    const c = await assertCountsEqualLists("dev+db", true)
    assert.equal(c.UAE, 6)
    assert.equal(c.UK, 3)
    assert.equal(c.Oman, 1)
  })

  // ── efficiency ───────────────────────────────────────────────────────────────────────────────────
  await test("EFFICIENCY: counting all 16 countries reads abroad_jobs ONCE — and so does listing every country (country is not part of the read)", async () => {
    scenario({ production: true })
    await getAbroadCountryCounts(names)
    assert.equal(abroadReads(), 1, "one shared read for all the counts")

    scenario({ production: true })
    for (const c of names) await getAbroadJobsPaginated({ country: c, page: 1, limit: 1 })
    assert.equal(abroadReads(), 1, "16 country lists share the same read; the old per-country approach issued 16")

    scenario({ production: true })
    await getAbroadCountryCounts(names)
    for (const c of names) await getAbroadJobsPaginated({ country: c, page: 1, limit: 1 })
    assert.equal(abroadReads(), 1, "counts and lists together: still one")
  })

  await test("EFFICIENCY: getVisibleAbroadCountryCounts() — the function the page, hero and APIs call — is one read, with the right shape", async () => {
    scenario({ production: true })
    const cards = await getVisibleAbroadCountryCounts()
    assert.equal(abroadReads(), 1)
    assert.equal(cards.length, ABROAD_COUNTRY_TARGETS.length)
    assert.deepEqual(cards.map(c => c.name), names, "order and names follow the targets")
    const byName = Object.fromEntries(cards.map(c => [c.name, c.jobs]))
    assert.equal(byName.UAE, 6)
    assert.equal(byName.UK, 3)
    assert.equal(byName.Oman, 1)
    for (const t of ABROAD_COUNTRY_TARGETS) {
      const card = cards.find(c => c.name === t.country)!
      assert.equal(card.flag, t.flag)
      assert.equal(card.desc, t.desc)
      assert.notEqual(card.jobs, t.count, `${t.country}: the marketing target (${t.count}) is never shown as a count`)
    }
  })

  await test("EFFICIENCY: list + counts + hero-style callers of ONE request share a single abroad_jobs read", async () => {
    scenario({ production: true })
    await Promise.all([
      getVisibleAbroadCountryCounts(),            // page country cards
      getVisibleAbroadCountryCounts(),            // hero strip (second caller in the same render)
      getAbroadJobsPaginated({ page: 1, limit: 20 }), // SSR initial data
      getAbroadVisibleCounts({}),                 // hero board counts
      getAbroadJobs(),                            // detail-page / landing style callers
    ])
    assert.equal(abroadReads(), 1)
    // A country filter reuses the shared read; a genuinely different DB query (another category) is a different read.
    await getAbroadJobsPaginated({ country: "Canada", page: 1, limit: 20 })
    assert.equal(abroadReads(), 1)
    await getAbroadJobsPaginated({ category: "Engineering", page: 1, limit: 20 })
    assert.equal(abroadReads(), 2, "the memo never serves a different query stale data")
  })

  // ── failure handling ─────────────────────────────────────────────────────────────────────────────
  await test("DB error in production: every card is 0 (not a target, not invented) and still equals the list", async () => {
    scenario({ production: true, db: "error" })
    const c = await assertCountsEqualLists("prod+error")
    for (const name of names) assert.equal(c[name], 0, name)
  })

  await test("DB throws in production: counts resolve to 0 without throwing", async () => {
    scenario({ production: true, db: "throw" })
    const c = await getAbroadCountryCounts(names)
    for (const name of names) assert.equal(c[name], 0, name)
    const cards = await getVisibleAbroadCountryCounts()
    assert.ok(cards.every(card => card.jobs === 0))
  })

  await test("Supabase not configured in production: no demo inventory, every card 0, equal to the list", async () => {
    scenario({ production: true, configured: false })
    const c = await assertCountsEqualLists("prod+unconfigured")
    for (const name of names) assert.equal(c[name], 0, name)
    assert.equal(abroadReads(), 0, "nothing to read")
  })

  // ── local inventory (non-production fallback) ────────────────────────────────────────────────────
  await test("local-inventory mode (synthetic visible): card === list for every country; the same alias rules as the DB path", async () => {
    scenario({ synthetic: true }) // development, no JOB_DATA_SOURCE=supabase → local demo inventory
    const c = await assertCountsEqualLists("local", true)
    assert.ok(c.UAE > 20, "the whole local match set is counted — not just the first page of 20")
    assert.equal(c.uae, c.UAE, "case-insensitive")
    assert.equal(c["United Arab Emirates"], c.UAE, "UAE ↔ United Arab Emirates in the local inventory too")
    assert.equal(c["United Kingdom"], c.UK, "UK ↔ United Kingdom in the local inventory too")
    assert.ok(c.UK > 0)
    assert.equal(c.kingdom, 0, "a fragment matches nothing")
    assert.equal(c.Emirat, 0)
    assert.equal(abroadReads(), 0, "local mode never touches the database")
    // The UK card lists only UK rows; Oman lists only Oman rows.
    const uk = await getAbroadJobs({ country: "UK" })
    assert.ok(uk.length === c.UK && uk.every(j => j.country === "UK"))
    const oman = await getAbroadJobs({ country: "Oman" })
    assert.ok(oman.length === c.Oman && oman.every(j => j.country === "Oman"))
  })

  await test("local-inventory mode, synthetic HIDDEN: nothing is counted and the list agrees", async () => {
    scenario({})
    const c = await assertCountsEqualLists("local-hidden")
    for (const name of names) assert.equal(c[name], 0, name)
  })

  await test("DB error outside production falls back to the local inventory for the card and the list alike", async () => {
    scenario({ dbSource: true, db: "error", synthetic: true })
    const c = await assertCountsEqualLists("dev+error→local", true)
    assert.ok(c.UAE > 20)
  })

  await test("deep pages still work in local mode (the first page of 20 is no longer all the list can hold)", async () => {
    scenario({ synthetic: true })
    const p1 = await getAbroadJobsPaginated({ country: "UAE", page: 1, limit: 20 })
    const p2 = await getAbroadJobsPaginated({ country: "UAE", page: 2, limit: 20 })
    assert.equal(p1.items.length, 20)
    assert.ok(p2.items.length > 0, "page 2 has rows")
    assert.equal(new Set([...p1.items, ...p2.items].map(j => j.id)).size, p1.items.length + p2.items.length, "no overlap between pages")
  })

  console.log(`\nabroad country-count tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
}

void main()
