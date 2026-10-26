/**
 * detailRouteId.test.ts — regression guard for the sitemap job-detail 404s (PR #54 preview QA:
 * 190 Abroad + 5 WFH sitemap URLs, every one a 404, on preview AND production).
 *
 *   npm run test:detail-route-id
 *
 * Root cause (proven from runtime logs: `[detail-miss] {"reason":"invalid-id","id":"himalayas%3A…"}`):
 * Next.js hands a dynamic `[id]` segment to the page still percent-encoded, so `/jobs/wfh/himalayas:<hash>`
 * arrived as `himalayas%3A<hash>`. `isValidJobId` rejects "%", so the loader returned null before any
 * database query ran. Every aggregated (Himalayas) id contains ":", i.e. every one of them 404'd.
 *
 * This test walks the SAME path a crawler takes: stored row → sitemap entry (the real policy) → URL path →
 * the param Next delivers → the route-boundary decode → the loader's id gate → the renderability gate.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeRouteId, isValidJobId, isRenderableJob } from "./renderable"
import { jobRowsToSitemapEntries, type SitemapJobRow, type SitemapJobBoard } from "../seo/sitemapPolicy"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")

const BASE = "https://www.noblejob.in"
const hash = (n: number) => n.toString(16).padStart(32, "0")

/** Aggregated (Himalayas) rows shaped like the stored ones. */
function row(board: SitemapJobBoard, n: number): SitemapJobRow {
  return {
    id: `himalayas:${hash(n)}`,
    title: `Remote Engineer ${n}`,
    company: `Remote Co ${n}`,
    description: "Build and ship distributed systems for a remote-first product team.",
    location: board === "abroad" ? "Berlin" : "Worldwide",
    country: board === "abroad" ? "Germany" : null,
    provenance: "AGGREGATED",
    apply_url: `https://himalayas.app/companies/remote-co-${n}/jobs/engineer-${n}`,
    status: "active",
    source: "himalayas",
  }
}

/** What Next.js passes as `params.id` for a request path segment. */
const nextParam = (urlPath: string) => encodeURIComponent(decodeURIComponent(urlPath.split("/").pop() as string))

for (const board of ["wfh", "abroad"] as const) {
  const rows = [1, 2, 3, 40].map(n => row(board, n))
  const entries = jobRowsToSitemapEntries(board, rows, BASE, { now: new Date("2026-10-26T00:00:00Z") })

  test(`${board}: every aggregated row is listed in the sitemap`, () => {
    assert.equal(entries.length, rows.length)
  })

  test(`${board}: the id Next delivers for each sitemap URL is the STORED id after the route-boundary decode`, () => {
    entries.forEach((e, i) => {
      const delivered = nextParam(new URL(e.url).pathname)
      assert.ok(delivered.includes("%3A"), "premise: Next delivers the colon percent-encoded")
      assert.equal(decodeRouteId(delivered), rows[i].id)
    })
  })

  test(`${board}: the loader's id gate REJECTS the raw delivered param (the bug) and ACCEPTS the decoded id (the fix)`, () => {
    entries.forEach((e, i) => {
      const delivered = nextParam(new URL(e.url).pathname)
      assert.equal(isValidJobId(delivered), false)
      assert.equal(isValidJobId(decodeRouteId(delivered)), true)
      assert.equal(isRenderableJob({ ...rows[i], applyUrl: rows[i].apply_url }, board), true)
    })
  })

  test(`${board}: a sitemap URL only exists for ids the detail route can resolve`, () => {
    for (const e of entries) {
      const id = decodeRouteId(nextParam(new URL(e.url).pathname))
      assert.equal(isValidJobId(id), true, e.url)
    }
  })

  test(`${board}: the detail page decodes its param once, at the boundary (metadata AND page)`, () => {
    const src = read(`src/app/jobs/${board}/[id]/page.tsx`)
    const decodes = src.match(/const id = decodeRouteId\(\(await params\)\.id\)/g) ?? []
    assert.equal(decodes.length, 2, "generateMetadata and the page must both decode")
    assert.ok(!/const \{ id \} = await params/.test(src), "no raw param may reach the loader")
  })
}

test("decodeRouteId: decodes once; stays strict about what remains", () => {
  assert.equal(decodeRouteId("himalayas%3Aabc"), "himalayas:abc")
  assert.equal(decodeRouteId("himalayas:abc"), "himalayas:abc")
  // double-encoded → one layer removed, still invalid ("%" remains) → 404, not silently re-decoded
  assert.equal(decodeRouteId("himalayas%253Aabc"), "himalayas%3Aabc")
  assert.equal(isValidJobId(decodeRouteId("himalayas%253Aabc")), false)
})

test("decodeRouteId: malformed escapes and path-ish ids never become valid ids", () => {
  assert.equal(decodeRouteId("%E0%A4%A"), "%E0%A4%A")
  for (const bad of ["%E0%A4%A", "..%2F..%2Fetc", "a%20b", "a%2Fb", "%3Fx", "%00", "undefined", "null"]) {
    assert.equal(isValidJobId(decodeRouteId(bad)), false, bad)
  }
})

test("ordinary ids (uuid, slug) are unchanged by the decode", () => {
  for (const id of ["00000000-0000-4000-8000-000000000001", "abroad-seed-12", "ssc-cgl-2026"]) {
    assert.equal(decodeRouteId(id), id)
    assert.equal(isValidJobId(decodeRouteId(id)), true)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
