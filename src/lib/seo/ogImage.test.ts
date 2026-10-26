/**
 * ogImage.test.ts — the social-share image must actually RENDER.
 *
 * Regression for the 0-byte /opengraph-image seen on both preview and production: satori (the renderer behind
 * next/og) rejects a <div> with more than one child node unless it declares `display: flex`; the share
 * image had two such wrappers, so rendering threw AFTER the 200 headers were sent and the client received an
 * empty `image/png` body (and the CDN cached it as immutable). This renders the real route handler and
 * checks the bytes are a 1200×630 PNG.
 *
 * Offline-safe: next/og fetches the Twemoji SVG for the 🏛 glyph from a CDN while rendering; that single
 * request is answered with a tiny valid SVG so the test needs no network (CI has one, the sandbox does not).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`)
  }
}

;(globalThis as unknown as { React: unknown }).React = require("react")

const EMOJI_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><rect width="36" height="36" fill="#fbbf24"/></svg>'

async function renderOg(): Promise<{ res: Response; bytes: Buffer }> {
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if (/cdn\.jsdelivr\.net\/.*twemoji/i.test(url) || /twemoji/i.test(url)) {
      return new Response(EMOJI_SVG, { status: 200, headers: { "content-type": "image/svg+xml" } })
    }
    return realFetch(input as never, init)
  }) as typeof fetch
  try {
    const mod = require("../../app/opengraph-image")
    const res: Response = await mod.default()
    return { res, bytes: Buffer.from(await res.arrayBuffer()) }
  } finally {
    globalThis.fetch = realFetch
  }
}

;(async () => {
  await test("OG: the route handler renders a non-empty PNG (not a 0-byte body)", async () => {
    const { res, bytes } = await renderOg()
    assert.equal(res.status, 200)
    assert.match(res.headers.get("content-type") ?? "", /image\/png/)
    assert.ok(bytes.length > 10_000, `PNG should be substantial, got ${bytes.length} bytes`)
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature")
  })

  await test("OG: the PNG is 1200 × 630 (the declared size)", async () => {
    const { bytes } = await renderOg()
    assert.equal(bytes.readUInt32BE(16), 1200)
    assert.equal(bytes.readUInt32BE(20), 630)
  })

  await test("OG: wiring — multi-child wrappers declare display:flex (what satori requires) and the copy makes no unverified claim", () => {
    const src = readFileSync(join(process.cwd(), "src/app/opengraph-image.tsx"), "utf8")
    assert.match(src, /<div style=\{\{ display: 'flex', flexDirection: 'column' \}\}>\s*<div style=\{\{ fontSize: 56/, "logo + tagline wrapper")
    assert.match(src, /<div style=\{\{ display: 'flex', gap: 12, fontSize: 38/, "headline wrapper (text + accent span)")
    assert.doesNotMatch(src, /Free Forever|verified|\d[\d,]*\+/i)
  })

  console.log(`\nog image tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
})()
