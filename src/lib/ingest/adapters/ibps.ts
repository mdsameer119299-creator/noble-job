/**
 * IBPS adapter — parses the recruitment-drive list from https://www.ibps.in
 * (server-rendered HTML). Each drive links to the official apply portal
 * (ibpsreg.ibps.in/<code>/) and carries "<ORG> Recruitment of <POST> Registration From <date>".
 *
 * Strategy: official recruitment page (HTML).
 */
import type { SourceAdapter, RawNotification } from "../types"

const HOME_URL = "https://www.ibps.in/"
const UA = "Mozilla/5.0 (compatible; NobleJobBot/1.0; +https://www.noblejob.in)"

function decode(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim()
}

async function fetchIbps(): Promise<RawNotification[]> {
  const res = await fetch(HOME_URL, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(20000), cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const out: RawNotification[] = []
  const seen = new Set<string>()
  for (const a of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = a[1]
    const title = decode(a[2])
    // Only real, dated recruitment drives (apply-portal links).
    if (!/ibpsreg\.ibps\.in/i.test(href)) continue
    if (!/recruit/i.test(title) || title.length < 12) continue

    const code = (href.match(/ibpsreg\.ibps\.in\/([a-z0-9]+)/i) || [])[1] || ""
    if (!code || seen.has(code)) continue
    seen.add(code)

    const m = title.match(/^(.*?)\s+Recruitment of\s+(.*?)\s+Registration From\s+([0-9A-Za-z-]+)/i)
    const org = (m ? m[1] : title.split(/recruit/i)[0]).trim() || "IBPS"
    let post = (m ? m[2] : "Various Posts").trim()
    if (post.length > 80) post = post.slice(0, 80).replace(/[,\s]+\S*$/, "")
    const start = m ? m[3].replace(/-/g, " ") : undefined
    const year = (title.match(/20\d{2}/) || start?.match(/20\d{2}/) || ["2026"])[0]

    if (!org || !post) continue // quality control
    out.push({
      externalId: `ibps-${code}`,
      title: `${org} Recruitment of ${post} ${year}`.replace(/\s+/g, " ").trim(),
      org,
      post,
      lastDate: "TBA", // closing date lives on the apply portal; treated as open
      startDate: start,
      officialUrl: href,
      tab: "latest",
    })
  }
  return out
}

export const ibpsAdapter: SourceAdapter = {
  id: "ibps",
  label: "IBPS (Recruitment Drives)",
  kind: "html",
  enabled: true,
  fetch: fetchIbps,
}
