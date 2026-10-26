/**
 * abroadCountryCounts.test.ts — the Abroad country cards are COUNTED from one shared read, and each card's
 * number equals the size of the list it opens.
 *
 *   npm run test:abroad-counts
 *
 * Hermetic: the Supabase server client and the admin-settings service are replaced by in-memory fakes
 * (module interception), so nothing here opens a network connection, reads or writes a real database, or
 * needs credentials. The fake models only what the Abroad list uses from PostgREST:
 *   .from("abroad_jobs").select(..).eq("status","active").ilike("country","%name%").order(..)
 * where ILIKE is case-insensitive substring matching — the same semantics the list's SQL filter has.
 *
 * What is proven:
 *   • for every country card (and for extra case / substring probes) count === getAbroadJobsPaginated({country}).total
 *     in production-DB mode, with synthetic rows hidden and visible, in DB-error / DB-throw / unconfigured
 *     fallbacks, and in local-inventory mode;
 *   • rows that are not active, not renderable, or synthetic-while-hidden are never counted, exactly as in the list;
 *   • case-insensitivity (db: substring, local: equality) is preserved per source;
 *   • counting 16 countries costs ONE `abroad_jobs` read (the old per-country approach cost 16), and the
 *     list + counts + hero-style callers of one request still share that single read;
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
const abroadReads = () => reads.filter(t => t === "abroad_jobs").length

function queryBuilder(table: string) {
  const preds: Array<(r: Row) => boolean> = []
  const b = {
    select: () => b,
    eq: (col: string, v: unknown) => { preds.push(r => r[col] === v); return b },
    ilike: (col: string, pattern: string) => {
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
    dbRow("UAE"), dbRow("UAE"), dbRow("UAE"), dbRow("uae"), dbRow("United Arab Emirates"),
    dbRow("Saudi Arabia"), dbRow("Saudi Arabia"),
    dbRow("Qatar"),
    dbRow("Qatar", { description: "" }),                         // not renderable → in neither list nor count
    dbRow("Qatar", { status: "closed" }),                        // not active → in neither list nor count
    dbRow("Romania"), dbRow("Oman"),                             // "Oman" ILIKE-matches Romania too (substring semantics)
    dbRow("United Kingdom"), dbRow("United Kingdom"), dbRow("Ukraine"), // "UK" substring-matches Ukraine, not United Kingdom
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
  resetRequest()
}

async function main() {
  const { getAbroadCountryCounts, getAbroadJobsPaginated, getAbroadJobs } = await import("./abroadJobService")
  const { getVisibleAbroadCountryCounts, getAbroadVisibleCounts } = await import("./visibleCounts")
  const { ABROAD_COUNTRY_TARGETS } = await import("../data/jobInventory")

  const names = ABROAD_COUNTRY_TARGETS.map(c => c.country)
  // Extra probes: other casings, a substring that only ILIKE matches, a name no row has.
  const probes = [...names, "uae", "UAE", "oman", "ROMANIA", "kingdom", "Emirates", "Atlantis"]

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
  await test("production DB, synthetic hidden: every card === the size of the list it opens (case + substring probes included)", async () => {
    scenario({ production: true })
    const c = await assertCountsEqualLists("prod", true)
    // Explicit numbers, so a bug that breaks list AND count the same way still fails:
    assert.equal(c.UAE, 4, "UAE ILIKE-matches UAE×3 + uae; the demo row is hidden; 'United Arab Emirates' does not contain 'uae'")
    assert.equal(c["Saudi Arabia"], 2)
    assert.equal(c.Qatar, 1, "the non-renderable and the closed Qatar rows are excluded exactly as in the list")
    assert.equal(c.Canada, 3, "case-insensitive: CANADA counts for Canada")
    assert.equal(c.Oman, 2, "substring semantics are preserved: Oman also matches Romania")
    assert.equal(c.UK, 1, "substring semantics are preserved: UK matches Ukraine, not United Kingdom")
    assert.equal(c.Germany, 1)
    assert.equal(c.Bahrain, 0)
    assert.equal(c.uae, c.UAE, "country names are matched case-insensitively")
    assert.equal(c.Atlantis, 0)
  })

  await test("production DB, synthetic VISIBLE (admin switch on): the demo row is counted by the card and the list alike", async () => {
    scenario({ production: true, synthetic: true })
    const c = await assertCountsEqualLists("prod+synthetic", true)
    assert.equal(c.UAE, 5)
  })

  await test("non-production with the Supabase data source: same rules, card === list", async () => {
    scenario({ dbSource: true })
    const c = await assertCountsEqualLists("dev+db", true)
    assert.equal(c.UAE, 4)
  })

  // ── efficiency ───────────────────────────────────────────────────────────────────────────────────
  await test("EFFICIENCY: counting all 16 countries reads abroad_jobs ONCE (the per-country list approach read it 16 times)", async () => {
    scenario({ production: true })
    await getAbroadCountryCounts(names)
    assert.equal(abroadReads(), 1, "one shared read")

    scenario({ production: true })
    for (const c of names) await getAbroadJobsPaginated({ country: c, page: 1, limit: 1 })
    assert.equal(abroadReads(), names.length, "baseline: the old approach is one full read per country — the harness measures what it claims")
  })

  await test("EFFICIENCY: getVisibleAbroadCountryCounts() — the function the page, hero and APIs call — is one read, with the right shape", async () => {
    scenario({ production: true })
    const cards = await getVisibleAbroadCountryCounts()
    assert.equal(abroadReads(), 1)
    assert.equal(cards.length, ABROAD_COUNTRY_TARGETS.length)
    assert.deepEqual(cards.map(c => c.name), names, "order and names follow the targets")
    const byName = Object.fromEntries(cards.map(c => [c.name, c.jobs]))
    assert.equal(byName.UAE, 4)
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
    // A genuinely different query (a filter) is a different read — the memo never serves it stale data.
    await getAbroadJobsPaginated({ country: "Canada", page: 1, limit: 20 })
    assert.equal(abroadReads(), 2)
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
  await test("local-inventory mode (synthetic visible): card === list for every country; equality, not substring, as the local list filters", async () => {
    scenario({ synthetic: true }) // development, no JOB_DATA_SOURCE=supabase → local demo inventory
    const c = await assertCountsEqualLists("local", true)
    assert.ok(c.UAE > 20, "the whole local match set is counted — not just the first page of 20")
    assert.equal(c.uae, c.UAE, "case-insensitive equality")
    assert.equal(c.Emirates, 0, "local filtering is equality, so a fragment matches nothing")
    assert.equal(abroadReads(), 0, "local mode never touches the database")
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
