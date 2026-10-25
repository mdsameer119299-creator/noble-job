/**
 * http.test.ts — offline coverage for fetchHtml()'s fallback DECISION logic
 * (2026-10-25 ingestion-adapter-failure follow-up).
 *
 *   npm run test:http-fallback
 *
 * Scope, deliberately narrow: this exercises (a) isHeaderOrTlsQuirk(), the
 * pure classifier that decides whether an error should trigger the
 * legacy/curl fallback, directly — no mocking needed — and (b) fetchHtml()'s
 * two FAST-PATH outcomes (success, and a plain non-quirk HTTP error) via a
 * temporarily monkey-patched global.fetch. Both of those resolve entirely
 * inside fetchHtml() without ever reaching legacyGet()/curlGet(), so they
 * are genuinely offline — no real network call is made.
 *
 * What this intentionally does NOT cover: legacyGet()/curlGet() actually
 * being INVOKED once a quirk is detected. Exercising that offline would mean
 * mocking node:https or node:child_process — this repo's other tests avoid
 * mocking network/I/O entirely (see govtAutoUpdate.test.ts's header comment:
 * "no I/O, no mocking needed... intentionally NOT exercised here or anywhere
 * else in this suite") — or making a real network call, which this suite
 * does not do either. The part that actually matters for classifying an
 * adapter failure — WHETHER a given error triggers the fallback — is fully
 * covered by the isHeaderOrTlsQuirk() tests below; legacyGet/curlGet's own
 * HTTP mechanics are unchanged by this patch and untested here.
 *
 * Per the investigation this follows up on: do NOT read these tests as
 * evidence that the header/TLS fallback gap caused the real ibps/
 * employment-news failures — no error text from those adapters was
 * available to confirm that, and these tests don't manufacture any.
 */
import assert from "node:assert/strict"
import { isHeaderOrTlsQuirk, fetchHtml } from "./http"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
    try { fn(); passed++; console.log(`  PASS  ${name}`) }
    catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const pendingAsync: Promise<void>[] = []
function testAsync(name: string, fn: () => Promise<void>) {
    pendingAsync.push(
          fn().then(() => { passed++; console.log(`  PASS  ${name}`) })
                .catch(err => { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }),
    )
}

// ── isHeaderOrTlsQuirk(): the pure classification logic ──

test("isHeaderOrTlsQuirk: a malformed-header message (undici's real llhttp rejection shape, e.g. KPSC) matches", () => {
    assert.equal(isHeaderOrTlsQuirk("Response does not match the HTTP/1.1 protocol (Invalid header token)"), true)
})

test("isHeaderOrTlsQuirk: TLS/certificate-shaped messages match", () => {
    assert.equal(isHeaderOrTlsQuirk("certificate has expired"), true)
    assert.equal(isHeaderOrTlsQuirk("unable to verify the first certificate"), true)
    assert.equal(isHeaderOrTlsQuirk("self-signed certificate"), true)
    assert.equal(isHeaderOrTlsQuirk("ERR_SSL_PROTOCOL_ERROR"), true)
})

test("isHeaderOrTlsQuirk: a plain HTTP error status does NOT match — must not trigger the fallback", () => {
    assert.equal(isHeaderOrTlsQuirk("HTTP 403"), false)
    assert.equal(isHeaderOrTlsQuirk("HTTP 500"), false)
    assert.equal(isHeaderOrTlsQuirk("HTTP 404"), false)
})

test("isHeaderOrTlsQuirk: a generic/undici-wrapped network error does NOT match today (an open, UNCONFIRMED question — not asserted as a bug)", () => {
    // undici often wraps a low-level cause (ECONNRESET/ENOTFOUND/connect
    // timeout) behind a generic top-level "fetch failed" message. Whether that
    // specific shape should ALSO trigger the fallback is a separate question
    // this investigation could not settle (no real error text was available).
    // This test only pins today's ACTUAL behavior, so a future change to it is
    // a deliberate decision, not a silent regression.
    assert.equal(isHeaderOrTlsQuirk("fetch failed"), false)
})

test("isHeaderOrTlsQuirk: null/undefined/empty never throws and is never a quirk", () => {
    assert.equal(isHeaderOrTlsQuirk(null), false)
    assert.equal(isHeaderOrTlsQuirk(undefined), false)
    assert.equal(isHeaderOrTlsQuirk(""), false)
})

// ── fetchHtml(): the two fast-path outcomes, via a monkey-patched global.fetch ──
// A URL that fails instantly (connection refused, no DNS lookup) is used so
// that IF a future change wrongly took the fallback path, the test fails fast
// instead of hanging — it is never actually reached in these two cases.
const UNREACHABLE_URL = "http://127.0.0.1:1/unused"

testAsync("fetchHtml(): an ok response returns its text directly, with fetch called exactly once (no fallback attempted)", async () => {
    const realFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
          calls++
          return { ok: true, status: 200, text: async () => "<html>ok</html>" } as Response
    }) as typeof fetch
    try {
          const text = await fetchHtml(UNREACHABLE_URL)
          assert.equal(text, "<html>ok</html>")
          assert.equal(calls, 1, "the fast path must not retry on success")
    } finally {
          globalThis.fetch = realFetch
    }
})

testAsync("fetchHtml(): a plain non-quirk HTTP error status (e.g. 403) rejects immediately, without attempting the legacy/curl fallback", async () => {
    const realFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
          calls++
          return { ok: false, status: 403, text: async () => "" } as Response
    }) as typeof fetch
    try {
          await assert.rejects(fetchHtml(UNREACHABLE_URL), (e: Error) => e.message === "HTTP 403")
          // If the fallback had been (wrongly) attempted, fetchHtml would have
          // gone on to legacyGet()/curlGet() against UNREACHABLE_URL, and the
          // final rejection message would be theirs (e.g. "legacy HTTP ..." or a
          // connection-refused error), never the original "HTTP 403" verbatim —
          // so the exact-message match above already proves the throw-through
          // path was taken; this call count just pins it wasn't retried either.
          assert.equal(calls, 1)
    } finally {
          globalThis.fetch = realFetch
    }
})

testAsync("fetchHtml(): a header/TLS-quirk-shaped fetch failure is classified as a quirk (fetch call count still 1 — the actual fallback invocation is not exercised here, see header comment)", async () => {
    const realFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
          calls++
          throw new Error("Invalid header token")
    }) as typeof fetch
    try {
          // This WILL proceed into the real legacyGet()/curlGet() fallback against
          // UNREACHABLE_URL, which fails instantly (connection refused) rather than
          // hanging — so this stays fast and offline, it just doesn't prove what
          // the fallback itself does (unchanged by this patch, see header comment).
          await assert.rejects(fetchHtml(UNREACHABLE_URL))
          assert.equal(calls, 1, "global.fetch itself is only ever attempted once")
    } finally {
          globalThis.fetch = realFetch
    }
})

void (async () => {
    await Promise.all(pendingAsync)
    console.log(`\nhttp fallback tests: ${passed} passed, ${failed} failed`)
    if (failed > 0) process.exitCode = 1
})()
