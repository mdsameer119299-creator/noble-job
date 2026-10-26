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
 * plus .order(..).order(..).range(from,to) and select(.., {count:"exact"}); it RECORDS every ilike() so the test can
 * prove the country filter is not pushed down to SQL. Like PostgREST it caps every response at `maxRows`
 * (default 1000), sorts by the requested order keys, and can fail or throw on a chosen batch.
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
 *   • COMPLETENESS: with more than the response cap (1000) of active rows, records beyond the first page appear
 *     in the filtered list AND the count, count === list.total, nothing is duplicated or skipped at batch
 *     boundaries (also under tied posted_at and an exactly-full batch), a failed later batch yields the safe
 *     fallback — never a partial count — and the loop is bounded;
 *   • counting 16 countries — and listing any country — uses ONE shared paginated dataset per request (as many
 *     range() batches as the inventory needs; country is not part of the read), and the list + counts +
 *     hero-style callers of one request share it;
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
/** Every abroad_jobs batch request, in order: the range asked for and what the fake answered. */
let batches: Array<{ from: number; to: number; returned: number }> = []
let maxRows = 1000                   // PostgREST's response cap
let omitCount = false                // simulate a response without a total
let failBatch: { at: number; mode: "error" | "throw" } | null = null // 0-based batch index
/** Full passes over the dataset (a pass starts at offset 0). One shared dataset per request ⇒ 1. */
const abroadReads = () => batches.filter(b => b.from === 0).length
const abroadBatches = () => batches.length

function queryBuilder(table: string) {
  const preds: Array<(r: Row) => boolean> = []
  const orders: Array<{ col: string; asc: boolean }> = []
  let wantCount = false
  let range: [number, number] | null = null
  const b = {
    select: (_cols?: string, opts?: { count?: string }) => { wantCount = opts?.count === "exact"; return b },
    eq: (col: string, v: unknown) => { preds.push(r => r[col] === v); return b },
    ilike: (col: string, pattern: string) => {
      ilikes.push(`${table}.${col}`)
      const needle = pattern.replace(/^%/, "").replace(/%$/, "").toLowerCase()
      preds.push(r => String(r[col] ?? "").toLowerCase().includes(needle))
      return b
    },
    or: () => { throw new Error("unexpected .or() — this test never filters by q") },
    order: (col: string, o?: { ascending?: boolean }) => { orders.push({ col, asc: o?.ascending !== false }); return b },
    range: (from: number, to: number) => { range = [from, to]; return b },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const run = async () => {
        if (table !== "abroad_jobs") return { data: [], error: null }
        const index = batches.length
        const matched = rows.filter(r => preds.every(p => p(r)))
        // Rows the order keys cannot tell apart come back in an ARBITRARY order that differs from request to
        // request (as in Postgres without a unique sort key) — modelled by a per-request hash of the id.
        const arbitrary = (r: Row) => { let h = Math.imul(index + 1, 0x9e3779b1) >>> 0; for (const ch of String(r.id)) { h = Math.imul(h ^ ch.charCodeAt(0), 0x85ebca6b) >>> 0; h ^= h >>> 13 } return h >>> 0 }
        matched.sort((x, y) => {
          for (const o of orders) {
            const a = String(x[o.col] ?? ""), c = String(y[o.col] ?? "")
            if (a !== c) return (a < c ? -1 : 1) * (o.asc ? 1 : -1)
          }
          return arbitrary(x) - arbitrary(y)
        })
        const [from, to] = range ?? [0, matched.length - 1]
        const slice = matched.slice(from, Math.min(to, from + maxRows - 1) + 1)
        batches.push({ from, to, returned: slice.length })
        if (dbMode === "error" || failBatch?.at === index && failBatch.mode === "error") return { data: null, error: { message: "simulated database error" }, count: null }
        if (failBatch?.at === index && failBatch.mode === "throw") throw new Error("simulated mid-read failure")
        return { data: slice, error: null, count: wantCount && !omitCount ? matched.length : null }
      }
      return run().then(resolve, reject)
    },
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
  batches = []
  maxRows = 1000
  omitCount = false
  failBatch = null
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
  await test("EFFICIENCY: counting all 16 countries makes ONE pass over abroad_jobs — and so does listing every country (country is not part of the read)", async () => {
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

  await test("EFFICIENCY: getVisibleAbroadCountryCounts() — the function the page, hero and APIs call — is one shared pass, with the right shape", async () => {
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

  await test("EFFICIENCY: list + counts + hero-style callers of ONE request share a single paginated abroad_jobs dataset", async () => {
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

  // ── COMPLETENESS: more active rows than one response can hold ────────────────────────────────────
  /** N active rows whose ORDER (posted_at desc, id asc) equals their index; `put` overrides single positions. */
  function bigDataset(total: number, put: Record<number, Row | ((r: Row) => Row)> = {}, tiedPostedAt = false): Row[] {
    const out: Row[] = []
    for (let k = 0; k < total; k++) {
      const row = dbRow("Germany", {
        id: `himalayas:${String(k).padStart(40, "0")}`,
        posted_at: tiedPostedAt ? "2026-10-20T00:00:00Z" : new Date(Date.UTC(2026, 9, 20) - Math.floor(k / 50) * 60000).toISOString(),
      })
      const o = put[k]
      out.push(typeof o === "function" ? o(row) : o ? { ...row, ...o } : row)
    }
    return out
  }
  const PUT: Record<number, Row> = {
    0: { country: "UAE" }, 1998: { country: "United Arab Emirates" }, 2200: { country: "Dubai, UAE" },
    5: { country: "United Kingdom" }, 999: { country: "United Kingdom" }, 1000: { country: "United Kingdom" }, 1500: { country: "United Kingdom" }, 2349: { country: "United Kingdom" },
    1999: { country: "U.K." }, 2000: { country: "U.K." },
    1001: { country: "Oman" }, 2001: { country: "Oman" }, 1002: { country: "Romania" },
    1700: { country: "Ukraine" },
    1200: { country: "United Kingdom", description: "" },                       // not renderable
    1300: { country: "United Kingdom", status: "closed" },                        // not active
    1400: { country: "UAE", provenance: "SYNTHETIC", apply_url: "", source: "Live feed" }, // demo row, hidden
  }
  const BIG = 2350
  const excluded = new Set([1200, 1300, 1400]) // never listed or counted
  const idAt = (k: number) => `himalayas:${String(k).padStart(40, "0")}`
  const listedIdsOf = async (country?: string) => (await getAbroadJobs(country ? { country } : {})).map(j => j.id)
  const expectIds = (ks: number[]) => ks.map(idAt).sort()

  await test("COMPLETENESS: >1000 active rows — records beyond the first response page are listed AND counted, count === list.total", async () => {
    scenario({ production: true, data: bigDataset(BIG, PUT) })
    const counts = await assertCountsEqualLists("big", true)
    // Explicit expectations placed on page 1 (idx<1000), page 2 (1000-1999) and page 3 (2000+):
    assert.equal(counts.UK, 7, "UK rows sit on all three pages (5, 999 | 1000, 1500, 1999 | 2000, 2349); the non-renderable and closed ones are excluded")
    assert.equal(counts["United Kingdom"], 7)
    assert.equal(counts.Oman, 2, "Oman on page 2 and page 3; Romania (1002) is not Oman")
    assert.equal(counts.UAE, 3, "0 | 1998 | 2200 — the 'Dubai, UAE' record is on the third page; the hidden demo row is not counted")
    assert.equal(counts.Ukraine, 1)
    assert.equal(counts.ROMANIA, 1)
    const idsOf = async (c: string) => (await listedIdsOf(c)).sort()
    assert.deepEqual(await idsOf("UK"), expectIds([5, 999, 1000, 1500, 1999, 2000, 2349]), "the filtered UK LIST contains every later-page record")
    assert.deepEqual(await idsOf("Oman"), expectIds([1001, 2001]))
    assert.deepEqual(await idsOf("UAE"), expectIds([0, 1998, 2200]))
    const page = await getAbroadJobsPaginated({ country: "UK", page: 1, limit: 20 })
    assert.equal(page.total, counts.UK)
    // Germany is everything that is left: card === list === the fixture minus the specials.
    const specials = Object.keys(PUT).map(Number)
    assert.equal(counts.Germany, BIG - specials.length)
  })

  await test("COMPLETENESS: nothing is skipped or duplicated at the batch boundaries (the unfiltered list is exactly the renderable fixture)", async () => {
    scenario({ production: true, data: bigDataset(BIG, PUT) })
    const ids = await listedIdsOf()
    assert.equal(new Set(ids).size, ids.length, "no duplicates")
    const expected = Array.from({ length: BIG }, (_, k) => k).filter(k => !excluded.has(k))
    assert.deepEqual([...ids].sort(), expectIds(expected), "no skipped rows — including idx 999/1000 and 1999/2000, the page edges")
    assert.deepEqual(batches.map(b => [b.from, b.to, b.returned]), [[0, 999, 1000], [1000, 1999, 1000], [2000, 2999, 349]], `three bounded range() batches: ${JSON.stringify(batches)}`)
  })

  await test("COMPLETENESS: rows with IDENTICAL posted_at are not skipped or repeated between batches (id is the tie-breaker)", async () => {
    const data = bigDataset(BIG, PUT, true) // all posted_at equal: only the id tie-breaker keeps the batches stable (the fake orders ties arbitrarily per request)
    scenario({ production: true, data })
    const ids = await listedIdsOf()
    assert.equal(new Set(ids).size, ids.length)
    assert.equal(ids.length, BIG - excluded.size)
    const c = await getAbroadCountryCounts(["UK", "Oman", "UAE"])
    assert.deepEqual([c.UK, c.Oman, c.UAE], [7, 2, 3])
  })

  await test("COMPLETENESS: all 16 country cards + every country list + the hero reuse ONE paginated dataset (batches = ceil(N/1000), not 16×)", async () => {
    scenario({ production: true, data: bigDataset(BIG, PUT) })
    await Promise.all([getVisibleAbroadCountryCounts(), getVisibleAbroadCountryCounts(), getAbroadVisibleCounts({}), getAbroadJobs()])
    for (const n of names) await getAbroadJobsPaginated({ country: n, page: 1, limit: 20 })
    assert.equal(abroadReads(), 1, "one pass over the dataset")
    assert.equal(abroadBatches(), Math.ceil(BIG / 1000), "only the batches the inventory needs (3), shared by every caller")
    // The per-country-read baseline would have been names.length passes × 3 batches.
    assert.ok(abroadBatches() < names.length)
  })

  await test("BATCH EDGES: an exactly-full final batch ends the read correctly, with and without a reported total", async () => {
    for (const [n, withCount, expectBatches] of [[2000, true, 2], [2000, false, 3], [1000, true, 1], [1000, false, 2], [1001, true, 2], [999, false, 1], [1, true, 1]] as const) {
      scenario({ production: true, data: bigDataset(n) })
      omitCount = !withCount
      const ids = await listedIdsOf()
      assert.equal(ids.length, n, `${n} rows, count ${withCount}`)
      assert.equal(new Set(ids).size, n)
      assert.equal(abroadBatches(), expectBatches, `${n} rows, count ${withCount}: batches`)
      if (!withCount && n % 1000 === 0) assert.equal(batches.at(-1)!.returned, 0, "without a total, one extra empty batch establishes the end")
    }
  })

  await test("BATCH SIZE: a database that returns fewer rows per response than asked (lower max-rows) is still read completely", async () => {
    scenario({ production: true, data: bigDataset(BIG, PUT) })
    maxRows = 400
    const ids = await listedIdsOf()
    assert.equal(ids.length, BIG - excluded.size)
    assert.equal(new Set(ids).size, ids.length)
    assert.equal(abroadBatches(), Math.ceil(BIG / 400))
    assert.equal((await getAbroadCountryCounts(["UK"])).UK, 7)
  })

  await test("FAILURE: a later batch that errors can NOT yield a misleading partial count — safe fallback, card still === list", async () => {
    for (const mode of ["error", "throw"] as const) {
      for (const at of [1, 2]) {
        scenario({ production: true, data: bigDataset(BIG, PUT) })
        failBatch = { at, mode }
        const c = await assertCountsEqualLists(`prod+${mode}@${at}`)
        for (const n of names) assert.equal(c[n], 0, `${mode}@${at} ${n}: zero, not the ${1000 * at} rows that were already read`)
        assert.equal(c.Germany, 0)
        assert.equal(abroadBatches(), at + 1, "the read stops at the failing batch")
        assert.equal((await getVisibleAbroadCountryCounts()).every(card => card.jobs === 0), true)
      }
    }
  })

  await test("FAILURE outside production: a failed later batch falls back to the local inventory for card and list alike (never a partial DB set)", async () => {
    scenario({ dbSource: true, synthetic: true, data: bigDataset(BIG, PUT) })
    failBatch = { at: 1, mode: "error" }
    const c = await assertCountsEqualLists("dev+err@1→local", true)
    assert.ok(c.UAE > 20, "local inventory")
    assert.equal(c.Germany > 0 && c.Germany !== BIG - Object.keys(PUT).length, true, "not the (partial or full) DB fixture")
  })

  await test("BOUNDED: the read never loops without limit — past the safety ceiling it fails closed, it does not return a partial set", async () => {
    scenario({ production: true, data: bigDataset(600) })
    maxRows = 10 // 60 batches would be needed; the ceiling is 50
    const c = await assertCountsEqualLists("bounded")
    for (const n of names) assert.equal(c[n], 0, n)
    assert.equal(abroadBatches(), 50, "stopped at the ceiling")
  })

  await test("COMPLETENESS keeps every earlier rule: provenance + synthetic visibility apply to later-page rows exactly as to page one", async () => {
    scenario({ production: true, synthetic: true, data: bigDataset(BIG, PUT) })
    const c = await assertCountsEqualLists("big+synthetic", true)
    assert.equal(c.UAE, 4, "now the hidden demo row (page 2) is counted too — by the card and the list alike")
    scenario({ production: true, data: bigDataset(BIG, { ...PUT, 2100: { country: "UK", provenance: "UNCLASSIFIED", source: "unknown", apply_url: "" } }) })
    assert.equal((await getAbroadCountryCounts(["UK"])).UK, 7, "a later-page UNCLASSIFIED row is dropped by the renderability gate")
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
