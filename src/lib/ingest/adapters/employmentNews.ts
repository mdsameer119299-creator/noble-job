/**
 * Employment News adapter — parses the official "Job Highlights" table from
 * https://employmentnews.gov.in (Govt of India weekly). Server-rendered HTML
 * (ASP.NET), so a plain fetch + table parse works (no headless browser needed).
 *
 * Strategy: official recruitment page (HTML). Columns:
 *   ISSUED DATE | ORGANISATION | POST | METHOD OF APPOINTMENT | LAST DATE
 */
import type { SourceAdapter, RawNotification } from "../types"

// Full current-issue listing (≈19 rows) rather than the 8-row homepage teaser.
const HOME_URL = "https://employmentnews.gov.in/NewEmp/AllJobs.aspx?k=All"
const UA = "Mozilla/5.0 (compatible; NobleJobBot/1.0; +https://www.noblejob.in)"
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "DD/MM/YYYY" → "DD Mon YYYY" (the format the rest of the app parses). */
function toDisplayDate(s?: string): string | undefined {
  const m = (s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return undefined
  const d = +m[1], mo = +m[2], y = m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  return `${String(d).padStart(2, "0")} ${MONTHS[mo - 1]} ${y}`
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function rowCells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => decode(m[1]))
}

async function fetchEmploymentNews(): Promise<RawNotification[]> {
  const res = await fetch(HOME_URL, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  // Parse every table row across the page; keep rows whose first cell is a date.
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1])

  const out: RawNotification[] = []
  for (const r of rows) {
    const c = rowCells(r)
    if (c.length < 4) continue
    const [issued, org, post, method] = c
    const last = c[4] || ""
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(issued)) continue // header / malformed row
    if (!org || !post) continue // quality control: reject empty/missing
    const year = (last.match(/\d{4}/) || issued.match(/\d{4}/) || ["2026"])[0]
    const kind = /recruit/i.test(method) ? "Recruitment" : (method || "Recruitment")
    out.push({
      externalId: `${org}-${post}-${issued}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90),
      title: `${org} ${post} ${kind} ${year}`.replace(/\s+/g, " ").trim(),
      org,
      post,
      lastDate: toDisplayDate(last) || "TBA",
      startDate: toDisplayDate(issued),
      officialUrl: HOME_URL,
      tab: "latest",
    })
  }
  return out
}

export const employmentNewsAdapter: SourceAdapter = {
  id: "employment-news",
  label: "Employment News (Job Highlights)",
  kind: "html",
  enabled: true,
  fetch: fetchEmploymentNews,
}
