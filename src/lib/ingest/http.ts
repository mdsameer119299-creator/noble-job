/**
 * http.ts — resilient HTML fetch for ingestion adapters.
 *
 * Government portals are inconsistent: some return non-standard HTTP headers
 * that Node's global fetch (undici) rejects outright ("Response does not match
 * the HTTP/1.1 protocol (Invalid header token)" — e.g. KPSC), some need a real
 * browser User-Agent, and some present incomplete TLS chains. fetchHtml tries
 * the fast path (global fetch with a browser UA), then transparently falls back
 * to the legacy node:https client with `insecureHTTPParser` + relaxed TLS, which
 * tolerates exactly the quirks undici refuses (the same quirks curl tolerates).
 *
 * It does NOT paper over genuine network blocks (connect timeouts, e.g. BPSC
 * from non-India egress) — those still throw, surfacing the real cause.
 */
import https from "node:https"
import http from "node:http"
import { execFile } from "node:child_process"

/** Browser UA — many gov portals serve a stub/blocked page to unknown bots. */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const DEFAULT_TIMEOUT = 20000

/**
 * Decides whether a `fetch()` failure is the specific class of quirk the
 * legacy/curl fallback below exists for (malformed headers undici's llhttp
 * parser rejects, or an incomplete/legacy TLS chain) rather than, say, a
 * plain HTTP error status or a genuine network/DNS failure. A PLAIN "HTTP
 * 403"-shaped message deliberately does NOT match — a non-2xx status is not
 * a parser/TLS quirk, and retrying it via curl would just mask (or
 * pointlessly repeat) a real rejection from the origin server.
 *
 * Extracted as its own pure, exported function (2026-10-25) purely so it can
 * be unit-tested directly, without mocking the network — no behavior change.
 */
export function isHeaderOrTlsQuirk(message: string | null | undefined): boolean {
  return /Invalid header token|HTTP\/1\.1 protocol|header|parse|certificate|TLS|SSL|ERR_SSL|self-signed|unable to verify/i.test(message || "")
}

/** Legacy-client fetch: tolerates malformed headers + incomplete TLS chains. */
function legacyGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("http://") ? http : https
    const req = lib.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
        // The two flags that make this succeed where undici fails:
        insecureHTTPParser: true,
        // Incomplete/legacy TLS chains on some nic.in hosts — accept them for
        // read-only public list pages (we never send credentials here).
        rejectUnauthorized: false,
        timeout: timeoutMs,
      } as https.RequestOptions,
      res => {
        // Follow one level of redirect (gov portals love 301 → /en-us).
        const loc = res.headers.location
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc) {
          res.resume()
          const next = loc.startsWith("http") ? loc : new URL(loc, url).href
          legacyGet(next, timeoutMs).then(resolve, reject)
          return
        }
        if (!res.statusCode || res.statusCode >= 400) {
          res.resume()
          reject(new Error(`legacy HTTP ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        res.on("data", c => chunks.push(c as Buffer))
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      },
    )
    req.on("timeout", () => req.destroy(new Error("legacy timeout")))
    req.on("error", reject)
    req.end()
  })
}

/**
 * Last-resort fetch via the system `curl` binary. Some gov servers (e.g. KPSC)
 * emit HTTP headers that Node's llhttp parser rejects even with
 * insecureHTTPParser, but OpenSSL/curl tolerates. Available on GitHub Actions,
 * any VPS, and local dev; absent on Vercel's serverless sandbox (the spawn
 * simply fails there and the original error surfaces).
 */
function curlGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      ["-sSL", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-A", BROWSER_UA, url],
      { maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs + 2000 },
      (err, stdout) => {
        if (err) return reject(err)
        if (!stdout || stdout.length < 50) return reject(new Error("curl empty body"))
        resolve(stdout.toString())
      },
    )
  })
}

/**
 * Fetch a page as text. Escalating fallbacks for stubborn gov portals:
 *   1) global fetch (undici) + browser UA          — fast path
 *   2) node:https legacy client (insecureHTTPParser, relaxed TLS) — header/TLS quirks
 *   3) system curl                                  — headers even llhttp rejects
 */
export async function fetchHtml(url: string, timeoutMs = DEFAULT_TIMEOUT): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (e) {
    const msg = (e as Error & { cause?: { code?: string; message?: string } }).cause?.message || (e as Error).message
    if (isHeaderOrTlsQuirk(msg)) {
      try {
        return await legacyGet(url, timeoutMs)
      } catch {
        // llhttp rejects it too → curl is the only client that can parse it.
        return curlGet(url, timeoutMs)
      }
    }
    throw e
  }
}
