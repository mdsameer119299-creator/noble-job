/**
 * Lightweight PDF pipeline for ingestion. Uses pdf-parse (pure JS, no native
 * libs, no headless browser) — Hostinger-safe. Provides text extraction, a
 * strict recruitment classifier, and best-effort field extraction.
 */
const UA = "Mozilla/5.0 (compatible; NobleJobBot/1.0; +https://www.noblejob.in)"
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Fetch a PDF and extract its text. Returns "" for scanned/image PDFs or errors. */
export async function extractPdfText(url: string, timeoutMs = 18000): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return ""
    const buf = Buffer.from(await res.arrayBuffer())
    const mod = await import("pdf-parse/lib/pdf-parse.js")
    const pdf = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>
    const data = await pdf(buf)
    return (data.text || "").replace(/\s+/g, " ").trim()
  } catch {
    return ""
  }
}

// Must contain a genuine recruitment-ADVERTISEMENT phrase (not merely a topic word),
// so memoranda/guidelines/notices that mention "faculty"/"recruitment" don't qualify.
const INCLUDE = /(applications?\s+(?:are\s+)?invited|advertisement\s+no|recruitment\s+(?:of|for|to|notice|notification|drive|advertisement)|vacanc\w*\s+(?:notification|notice|circular|details|are\b)|walk[\s-]?in[\s-]?interview|engagement\s+of\b|filling\s+up\s+of\s+(?:the\s+)?posts?|direct\s+recruitment|no\.?\s*of\s+(?:vacanc\w*|posts?))/i
// …and the header must NOT declare it a non-recruitment / non-advertisement document.
// (Order-independent: these doc-type words reject results, memos, corrigenda, public
// notices, office orders, tenders/EOIs, withdrawals and continuation/extension notices
// even when their body quotes an earlier advertisement's "applications are invited".)
const EXCLUDE_HEADER = /\b(result|merit list|answer key|corrigend\w*|press release|public\s+notice|admit card|hall ticket|exam schedule|date sheet|cancellation|cancelled|withdraw\w*|postpone\w*|interview schedule|shortlist\w*|final rejection|cut.?off|score card|tender|notice\s+inviting|quotation|expression\s+of\s+interest|notice[\s-]*cum|office\s+order|office\s+memorand\w*|memorandum|in\s+continuation\s+of|guidelines?|minutes\s+of|syllabus|scheme\s+of|instructions?\s+to|frequently asked|api\s+score|inspire faculty|extension\s+of\s+(?:the\s+)?(?:last\s+)?date|revised\s+(?:schedule|list|result|merit)|addendum|reminder)\b/i

/** True only for genuine recruitment advertisements (text-based, classified). */
export function isRecruitmentPdf(text: string): boolean {
  if (!text || text.length < 200) return false // empty/scanned → reject
  // Scan the header zone (title + preamble); letterheads can push the doc-type
  // declaration a few hundred chars down, so 900 covers the masthead block.
  if (EXCLUDE_HEADER.test(text.slice(0, 900))) return false // doc type = result/memo/notice/extension/etc.
  return INCLUDE.test(text)
}

function toDisplay(d: number, mo: number, y: number): string | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  return `${String(d).padStart(2, "0")} ${MONTHS[mo - 1]} ${y}`
}

const monthIdx = (s: string) => MONTHS.findIndex(m => m.toLowerCase() === s.slice(0, 3).toLowerCase())

// Closing-date labels seen across central/PSU/court/university ads. Order-independent.
const LAST_DATE_LABEL = /(last date|closing date|last day|apply (?:on or )?before|online application(?:s)?(?: closes| last date)?|submission of (?:online )?application|receipt of (?:online )?application|last date for (?:receipt|submission|online))/i

/**
 * Extract a closing date from advertisement text. Anchors on a closing-date
 * label, then reads the next ~90 chars for a numeric (DD/MM/YYYY) or spelled-out
 * ("15 July 2026" / "July 15, 2026") date. Anchoring avoids grabbing unrelated
 * dates (advertisement date, meeting date). Returns "DD Mon YYYY" or undefined.
 */
function extractLastDate(text: string): string | undefined {
  const lm = text.match(LAST_DATE_LABEL)
  if (!lm || lm.index == null) return undefined
  const win = text.slice(lm.index, lm.index + 90)
  let m = win.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/)
  if (m) { let y = m[3]; if (y.length === 2) y = "20" + y; return toDisplay(+m[1], +m[2], +y) }
  m = win.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})[,\s]+(\d{4})/) // 15 July 2026
  if (m && monthIdx(m[2]) >= 0) return toDisplay(+m[1], monthIdx(m[2]) + 1, +m[3])
  m = win.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})/) // July 15, 2026
  if (m && monthIdx(m[1]) >= 0) return toDisplay(+m[2], monthIdx(m[1]) + 1, +m[3])
  return undefined
}

function clean(s?: string): string | undefined {
  if (!s) return undefined
  const t = s.replace(/\s+/g, " ").trim().replace(/[.,;:\-\s]+$/, "")
  return t.length >= 3 && t.length <= 90 ? t : undefined
}

export interface RecruitmentFields {
  advtNo?: string
  vacancy?: string
  lastDate?: string
  post?: string
  qualification?: string
  ageRange?: string
}

/** Best-effort field extraction from advertisement text. Missing → undefined. */
export function parseRecruitmentFields(text: string): RecruitmentFields {
  // advt number must contain a digit (avoids capturing stray words like "and"/"to").
  const advtRaw = (text.match(/advertisement\s*(?:no\.?|number|:)\s*((?:[A-Za-z]{1,5}[-\/. ]?)?\d{1,4}(?:[-\/][A-Za-z0-9]{1,6}){0,3})/i) || [])[1]
  const advtNo = advtRaw && /\d/.test(advtRaw) ? clean(advtRaw) : undefined
  const vacancy = (text.match(/(?:total\s+(?:no\.?\s*of\s+)?(?:vacanc\w*|posts?)|no\.?\s*of\s+(?:vacanc\w*|posts?))\s*[:\-]?\s*(\d{1,5})\b/i) || [])[1]
  const lastDate = extractLastDate(text)
  const post = clean((text.match(/(?:for the posts?\s+of|recruitment\s+(?:of|to the posts?\s+of)|post\s+of|name\s+of\s+(?:the\s+)?post)\s*[:\-]?\s*([A-Za-z][A-Za-z .,/&()'\-]{3,55})/i) || [])[1])
  const qualification = clean((text.match(/(?:educational\s+)?qualification[s]?\s*[:\-]?\s*([A-Za-z][A-Za-z .,/&()'\-]{8,70})/i) || [])[1])
  const age = text.match(/age\s*(?:limit)?[^0-9]{0,15}(\d{2})\s*(?:to|-|–|and)\s*(\d{2})\s*years/i)
  return { advtNo, vacancy, lastDate, post, qualification, ageRange: age ? `${age[1]}-${age[2]} Years` : undefined }
}
