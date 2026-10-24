/**
 * extractPublishedDate.ts — pull a REAL, source-stated publish/notice date out
 * of a notification's own title text, when the source explicitly labels one.
 *
 * Root cause this addresses: `RawNotification.publishedAt` ("supply it ONLY
 * when the source states it") was never populated by any adapter, even for
 * sources (MPPSC, and others) whose notice titles routinely carry an explicit
 * "Dated DD/MM/YYYY" or Hindi "दिनांक DD/MM/YYYY" marker from the commission
 * itself. With `publishedAt` always undefined, `source_published_at` stayed
 * NULL for every row, which made `isCurrentGovtNotification()` (the Oct 2026
 * fail-closed freshness gate) reject the ENTIRE government inventory — not a
 * threshold or tagging bug, a missing extraction step.
 *
 * Deliberately conservative: a date is returned ONLY when it is introduced by
 * an explicit "Dated" / "दिनांक" marker immediately followed by a DD/MM/YYYY
 * (or DD.MM.YYYY / DD-MM-YYYY) numeric date — never inferred from a bare
 * 4-digit year, an advertisement number, or a vacancy count. No marker, no
 * date: this never invents a publish date (mirrors the ingestion policy in
 * govtIntegrity.test.ts: "ingestion never fabricates dates").
 *
 * Indian government notices are written DD/MM/YYYY (never MM/DD); the parser
 * assumes that order throughout, matching every sample observed in production
 * (e.g. "31/12/2025", "16/03/2026" — unambiguous day-first dates).
 */

const DATE_MARKER =
    /(?:dated|date)\s*[:\-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})|दिनांक\s*[:\-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/gi

const MIN_YEAR = 2015

/** Validate a DD/MM/YYYY triple and return a UTC-midnight ISO string, or undefined. */
function toIso(dd: string, mm: string, yyyy: string, now: Date): string | undefined {
    const day = Number(dd)
    const month = Number(mm)
    const year = Number(yyyy)
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return undefined
    if (day < 1 || day > 31 || month < 1 || month > 12) return undefined
    if (year < MIN_YEAR || year > now.getUTCFullYear() + 1) return undefined
    const d = new Date(Date.UTC(year, month - 1, day))
    // Reject impossible calendar dates (e.g. 31/04) by checking the round-trip.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined
    // Never a future-dated notice beyond a short clock-skew allowance.
  if (d.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return undefined
    return d.toISOString()
}

/**
 * Find the first explicitly-labelled "Dated ..." / "दिनांक ..." date in `text`
 * and return it as an ISO timestamp (UTC midnight), or undefined when no
 * confidently-marked date is present. Scans the WHOLE untruncated source text
 * — callers must run this before slicing a title to its display length, since
 * the date is often the last thing in a long notice title.
 */
export function extractStatedPublishDate(text: string | undefined | null, now: Date = new Date()): string | undefined {
    if (!text) return undefined
    DATE_MARKER.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = DATE_MARKER.exec(text))) {
          const [dd, mm, yyyy] = m[1] !== undefined ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]]
          const iso = toIso(dd, mm, yyyy, now)
          if (iso) return iso
          // Marker matched but the date itself was invalid (e.g. 31/04) — keep
      // scanning in case the text has more than one dated marker.
    }
    return undefined
}
