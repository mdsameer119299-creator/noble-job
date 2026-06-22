/**
 * uppsc.ts — UPPSC (Uttar Pradesh PSC) adapter.
 *
 * UPPSC runs an AngularJS front-end, so the generic PDF-feed adapter found zero
 * `<a href="*.pdf">` links. But the notification list IS server-rendered into the
 * homepage HTML as list items of the form:
 *
 *   <li><a href=Open_PDF.aspx?<token> target=_Blank>
 *         <span class='date'>…30 Jun…2026…</span>
 *         <span class='lbl_css'>NOTICE REGARDING ADVT. NO. A-8/E-1/2025, ASSISTANT
 *                               PROSECUTION OFFICER (MAINS) EXAM-2025</span>
 *       </a></li>
 *
 * Open_PDF.aspx?<token> is the official notification document (server decrypts
 * the token to the real PDF). We parse the label text + date directly from HTML
 * — no headless browser, no PDF download — and keep only recruitment/advert
 * items (results, admit cards and calendars are filtered out).
 */
import type { SourceAdapter, RawNotification } from "../types"
import { fetchHtml } from "../http"

const LIST_URL = "https://uppsc.up.nic.in/"
const ORG = "Uttar Pradesh Public Service Commission"

const MONTHS: Record<string, string> = { jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec" }

function decode(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim()
}

/** Keep genuine recruitment/advertisement notices; drop results/admit/calendar. */
const KEEP = /\b(advt|advertisement|recruit|vacanc|direct recruitment|applications? are invited|notice regarding advt)\b/i
const DROP = /\b(result|answer key|marks|interview|admit card|cut-?off|calendar|selection list|score card)\b/i

function parseDate(block: string): string | undefined {
  // "<span class='date-display-single'>30 Jun</span> … 2026"
  const m = decode(block).match(/(\d{1,2})\s*([A-Za-z]{3})[a-z]*\s*(\d{4})/)
  if (!m) return undefined
  const mon = MONTHS[m[2].toLowerCase().slice(0, 3)]
  return mon ? `${m[1].padStart(2, "0")} ${mon} ${m[3]}` : undefined
}

async function fetchUppsc(): Promise<RawNotification[]> {
  const html = await fetchHtml(LIST_URL, 18000)
  const out: RawNotification[] = []
  const seen = new Set<string>()

  // Anchor hrefs are UNQUOTED: href=Open_PDF.aspx?<token> … </a>
  for (const a of html.matchAll(/<a[^>]*href=("?)(Open_PDF\.aspx\?[^\s"'>]+)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const token = a[2]
    const inner = a[3]
    const label = decode(inner.replace(/<span class=['"]?date['"]?[\s\S]*?<\/span>\s*<\/span>/i, "")) // strip date wrapper first
    const title = decode((inner.match(/lbl_css['"]?\s*>([\s\S]*?)<\/span>/i)?.[1]) || label)
    if (!title || title.length < 12) continue
    if (!KEEP.test(title) || DROP.test(title)) continue
    if (seen.has(title)) continue
    seen.add(title)

    const url = `${LIST_URL}${token}`
    const advt = (title.match(/A-\d+\/[A-Za-z0-9-]+\/\d{4}/) || title.match(/\b\d{1,3}\/\d{4}\b/) || [])[0]
    out.push({
      externalId: `uppsc-${(advt || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)}`,
      title: `UPPSC ${title}`.replace(/\s+/g, " ").trim().slice(0, 150),
      org: ORG,
      post: title,
      lastDate: parseDate(inner) || "TBA",
      state: "Uttar Pradesh",
      stateSlug: "uttar-pradesh",
      location: "Uttar Pradesh",
      officialUrl: url,
      notificationPdf: url,
      tab: "latest",
    })
  }
  return out
}

export const uppscAdapter: SourceAdapter = {
  id: "uppsc",
  label: "UPPSC (Uttar Pradesh)",
  kind: "html",
  enabled: true,
  fetch: fetchUppsc,
}
