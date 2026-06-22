/**
 * rpscPlaywright.ts — RPSC (Rajasthan PSC) via headless browser.
 *
 * rpsc.rajasthan.gov.in renders its recruitment-advertisement list client-side
 * (the server HTML has ~2 PDF links), so a plain fetch yields nothing. This
 * adapter drives a headless Chromium, waits for the list to hydrate, then
 * extracts the advertisement anchors.
 *
 * RUNTIME GATING: Playwright/Chromium is NOT available on Vercel's serverless
 * sandbox, so this adapter only activates when INGEST_PLAYWRIGHT=1 (set in the
 * GitHub Actions workflow / a VPS). Everywhere else it ships disabled and the
 * dynamic import is never reached, so the Vercel build/runtime is unaffected.
 * playwright lives in devDependencies for the same reason.
 */
import type { SourceAdapter, RawNotification } from "../types"

// Minimal structural types for the subset of the Playwright API used here, so
// this file type-checks without the package present (it's installed only in CI).
interface PwPage {
  goto(url: string, opts?: unknown): Promise<unknown>
  waitForSelector(sel: string, opts?: unknown): Promise<unknown>
  $$eval<T>(sel: string, fn: (els: Element[]) => T): Promise<T>
}
interface PwBrowser {
  newPage(opts?: unknown): Promise<PwPage>
  close(): Promise<void>
}

const LIST_URL = "https://rpsc.rajasthan.gov.in/recruitment-advertisement"
const ORG = "Rajasthan Public Service Commission"
const KEEP = /\b(recruit|advertis|advt|vacan|notification|appli|invited|posts?\b)/i
const DROP = /\b(result|answer key|marks|interview|admit|cut[- ]?off|syllabus|merit|score)\b/i

async function fetchRpsc(): Promise<RawNotification[]> {
  // Untyped dynamic import: keeps playwright OUT of the Vercel build entirely.
  // The GitHub Actions workflow installs it before running (see workflow file).
  let chromium: { launch: (o?: unknown) => Promise<PwBrowser> }
  try {
    const pw = (await import("playwright" as string)) as { chromium: typeof chromium }
    chromium = pw.chromium
  } catch {
    return [] // playwright not installed in this runtime — no-op
  }

  const browser = await chromium.launch({ args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" })
    await page.goto(LIST_URL, { waitUntil: "networkidle", timeout: 45000 })
    // Best-effort wait for any anchor list to appear.
    await page.waitForSelector("a", { timeout: 15000 }).catch(() => {})

    const links = await page.$$eval("a", as =>
      as.map(a => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent || "").replace(/\s+/g, " ").trim() })),
    )

    const out: RawNotification[] = []
    const seen = new Set<string>()
    for (const l of links) {
      const title = l.text
      if (!title || title.length < 10) continue
      if (!KEEP.test(`${title} ${l.href}`) || DROP.test(title)) continue
      const key = title.toLowerCase().slice(0, 90)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        externalId: `rpsc-${key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)}`,
        title: `RPSC ${title}`.replace(/\s+/g, " ").trim().slice(0, 150),
        org: ORG,
        post: title.slice(0, 120),
        lastDate: "TBA",
        state: "Rajasthan",
        stateSlug: "rajasthan",
        location: "Rajasthan",
        officialUrl: l.href || LIST_URL,
        notificationPdf: /\.pdf(\?|$)/i.test(l.href) ? l.href : undefined,
        tab: "latest",
      })
      if (out.length >= 30) break
    }
    return out
  } finally {
    await browser.close()
  }
}

export const rpscPlaywrightAdapter: SourceAdapter = {
  id: "rpsc",
  label: "RPSC (Rajasthan, headless)",
  kind: "html",
  // Only run where a headless browser exists (GitHub Actions / VPS).
  enabled: process.env.INGEST_PLAYWRIGHT === "1",
  fetch: fetchRpsc,
}
