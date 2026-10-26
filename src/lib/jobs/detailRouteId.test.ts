/**
 * detailRouteId.test.ts — regression guard for the sitemap job-detail 404s (PR #54 preview QA:
 * 190 Abroad + 5 WFH sitemap URLs, every one a 404, on preview AND production), and the exact contract of how a
 * request path segment becomes a job id.
 *
 *   npm run test:detail-route-id
 *
 * ROOT CAUSE (proven from Vercel runtime logs: the loader rejected the id "himalayas%3A…" as invalid):
 * Next.js hands a dynamic `[id]` segment to the page still percent-encoded, so `/jobs/wfh/himalayas:<hash>` arrives as
 * `params.id === "himalayas%3A<hash>"`. `isValidJobId` rejects "%", so the loader returned null before any database
 * query ran. Every aggregated (Himalayas) id contains ":", i.e. every one of them 404'd.
 *
 * THE REAL SEQUENCE (request path → platform → Next → page → decodeRouteId → isValidJobId):
 *
 *   1. next start / Next 15.5.19 — OBSERVED locally with a minimal app that echoes `params.id`:
 *        request segment      params.id
 *        himalayas:abc        himalayas%3Aabc      (a literal ":" is encoded, nothing else is touched)
 *        himalayas%3Aabc      himalayas%3Aabc
 *        himalayas%253Aabc    himalayas%253Aabc    (NOT decoded: stays double-encoded)
 *        a%2Fb, ..%2F..%2Fetc a%2Fb, ..%2F..%2Fetc (encoded slashes reach the page as text)
 *        %E0%A4%A             400 before the page runs
 *   2. Vercel — INFERRED from the preview, then confirmed by controls: the platform percent-decodes the path ONCE more
 *      before it reaches Next, so the page sees one layer less than `next start` shows. OBSERVED on the preview
 *      (2026-10-26, commit 0b70e00), for a stored WFH id and an Abroad id:
 *        ":" / "%3A" / "%3a" / "%253A"  → 200, canonical = the clean `…/himalayas:<hash>` URL, `index, follow`
 *        "%25253A" (triple)              → 404
 *        "%3A%2F", "%3A%252F", "..%2F..%2Fetc", "..%252F..%252Fetc", "%3Aq%3Fx%3D1", "%3A%20" → 404
 *      (A bare "%2e%2e" never reaches the app: the browser normalises it to the parent path before sending.)
 *   So `%253A` resolves on Vercel ONLY because the platform already removed a layer; on `next start` the same request
 *   is rejected. That alias is not designed behaviour, it is a harmless consequence: the page sets its canonical to the
 *   clean URL, the alias is never in the sitemap or in any internal link, and `decodeRouteId` stays strict — it decodes
 *   exactly ONE layer and the validator then rejects anything still containing "%", "/", "?", whitespace or "..".
 *
 * The model below encodes that sequence for BOTH hosts, so the contract is asserted wherever the page runs.
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

/* ------------------------------------------------------------------ */
/* Framework model                                                     */
/* ------------------------------------------------------------------ */

type Host = "next-start" | "vercel"
const HOSTS: Host[] = ["next-start", "vercel"]

/**
 * What `params.id` is for a request path SEGMENT, or null when no page runs at all (400, or the segment no longer
 * matches the single-segment `[id]` route).
 */
function frameworkParam(segment: string, host: Host): string | null {
  let seg = segment
  if (host === "vercel") {
    // inferred + confirmed by the triple-encoding control: one extra percent-decode before Next sees the path
    try { seg = decodeURIComponent(seg) } catch { return null }
    if (seg.includes("/")) return null // a decoded slash splits the segment: another route, not `[id]`
  }
  try { decodeURIComponent(seg) } catch { return null } // Next answers 400 to a malformed escape
  // observed: Next leaves existing escapes alone and encodes a literal ":"
  return seg.replace(/:/g, "%3A")
}

/** The id the loader looks up (and the page canonicalises to), or null when the page 404s before any database call. */
function resolveId(segment: string, host: Host): string | null {
  const param = frameworkParam(segment, host)
  if (param === null) return null
  const id = decodeRouteId(param)
  return isValidJobId(id) ? id : null
}

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

for (const board of ["wfh", "abroad"] as const) {
  const rows = [1, 2, 3, 40].map(n => row(board, n))
  const entries = jobRowsToSitemapEntries(board, rows, BASE, { now: new Date("2026-10-26T00:00:00Z") })
  const segmentOf = (url: string) => new URL(url).pathname.split("/").pop() as string

  test(`${board}: every aggregated row is listed in the sitemap`, () => {
    assert.equal(entries.length, rows.length)
  })

  test(`${board}: each sitemap URL resolves to its STORED id on both hosts`, () => {
    entries.forEach((e, i) => {
      for (const host of HOSTS) assert.equal(resolveId(segmentOf(e.url), host), rows[i].id, `${host} ${e.url}`)
    })
  })

  test(`${board}: the framework delivers the colon percent-encoded — the loader's id gate rejects that raw value (the bug) and accepts the decoded id (the fix)`, () => {
    entries.forEach((e, i) => {
      for (const host of HOSTS) {
        const delivered = frameworkParam(segmentOf(e.url), host) as string
        assert.ok(delivered.includes("%3A"), "premise: Next delivers the colon percent-encoded")
        assert.equal(isValidJobId(delivered), false, "raw delivered param")
        assert.equal(isValidJobId(decodeRouteId(delivered)), true, "decoded id")
      }
      assert.equal(isRenderableJob({ ...rows[i], applyUrl: rows[i].apply_url }, board), true)
    })
  })

  test(`${board}: encoded-colon spellings (":", "%3A", "%3a") resolve to the stored id on both hosts`, () => {
    const id = rows[0].id.slice("himalayas:".length)
    for (const host of HOSTS) for (const seg of [`himalayas:${id}`, `himalayas%3A${id}`, `himalayas%3a${id}`]) {
      assert.equal(resolveId(seg, host), rows[0].id, `${host} ${seg}`)
    }
  })

  test(`${board}: the detail page decodes its param once, at the boundary (metadata AND page)`, () => {
    const src = read(`src/app/jobs/${board}/[id]/page.tsx`)
    const decodes = src.match(/const id = decodeRouteId\(\(await params\)\.id\)/g) ?? []
    assert.equal(decodes.length, 2, "generateMetadata and the page must both decode")
    assert.ok(!/const \{ id \} = await params/.test(src), "no raw param may reach the loader")
  })
}

const ID = hash(7)

test("double-encoded colon: an ALIAS on Vercel only (the platform removes a layer), rejected on next-start; both agree on the stored id when it resolves", () => {
  assert.equal(resolveId(`himalayas%253A${ID}`, "vercel"), `himalayas:${ID}`)
  assert.equal(resolveId(`himalayas%253A${ID}`, "next-start"), null)
})

test("triple-encoded colon resolves nowhere: exactly one decode layer is ever accepted by the route", () => {
  for (const host of HOSTS) assert.equal(resolveId(`himalayas%25253A${ID}`, host), null, host)
})

test("encoded slashes never become an id (single, double, mixed with a valid colon)", () => {
  for (const host of HOSTS) for (const seg of [`a%2Fb`, `a%252Fb`, `himalayas%3A%2F${ID}`, `himalayas%3A%252F${ID}`, `%2F`, `%252F`]) {
    assert.equal(resolveId(seg, host), null, `${host} ${seg}`)
  }
})

test("path traversal never becomes an id (encoded, double-encoded, dot-only)", () => {
  for (const host of HOSTS) for (const seg of [`..%2F..%2Fetc`, `..%252F..%252Fetc`, `..`, `.`, `%2e%2e`, `%252e%252e`, `..%5C..%5Cetc`]) {
    assert.equal(resolveId(seg, host), null, `${host} ${seg}`)
  }
})

test("query / fragment / whitespace / control characters and malformed escapes never become an id", () => {
  for (const host of HOSTS) for (const seg of [`himalayas%3A${ID}%3Fx%3D1`, `himalayas%3A${ID}%23x`, `himalayas%3A%20${ID}`, `a%20b`, `%00`, `%0A`, `%E0%A4%A`, `%`, `%zz`, `undefined`, `null`, ``]) {
    assert.equal(resolveId(seg, host), null, `${host} ${JSON.stringify(seg)}`)
  }
})

test("decodeRouteId itself: decodes ONE layer; whatever remains is judged strictly by the validator", () => {
  assert.equal(decodeRouteId("himalayas%3Aabc"), "himalayas:abc")
  assert.equal(decodeRouteId("himalayas:abc"), "himalayas:abc")
  assert.equal(decodeRouteId("himalayas%253Aabc"), "himalayas%3Aabc")
  assert.equal(isValidJobId(decodeRouteId("himalayas%253Aabc")), false)
  assert.equal(decodeRouteId("%E0%A4%A"), "%E0%A4%A") // malformed → raw text → invalid
})

test("the validator is strict about every path-like character (not relaxed for the decode)", () => {
  for (const bad of ["a/b", "a\\b", "a?b", "a#b", "a b", " a", "a ", "..", "../x", "a..b/c", "%2F", "a%2Fb", "a\u0000b", "", "undefined", "null"]) {
    assert.equal(isValidJobId(bad), false, JSON.stringify(bad))
  }
  assert.equal(isValidJobId("himalayas:" + ID), true)
})

test("ordinary ids (uuid, slug) are unchanged by the decode on both hosts", () => {
  for (const id of ["00000000-0000-4000-8000-000000000001", "abroad-seed-12", "ssc-cgl-2026"]) {
    for (const host of HOSTS) assert.equal(resolveId(id, host), id)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
