/**
 * futureDeadline.ts — test fixtures need an application deadline that is ALWAYS still open.
 *
 * Why: the JobPosting builders correctly refuse to emit structured data for a closed job (a real
 * `validThrough` that is already past → null). Fixtures that hard-code a calendar date therefore
 * "expire" and start failing on that date, with no change to the code under test (this is what made
 * the govt JobPosting / apply-route / source-date suites fail from 2026-10-31 onwards).
 *
 * The deadline is derived from the real clock, never from the code under test, so the expected values
 * below are computed independently of `parseRealDate` / `endOfDayIst`.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

export interface FutureDeadline {
  /** Display form stored on govt rows, e.g. "18 Feb 2027". */
  label: string
  /** The instant `validThrough` must carry: 23:59:59 IST (= 18:29:59Z) on that calendar day. */
  validThrough: string
}

export function futureDeadline(daysAhead = 120, now: Date = new Date()): FutureDeadline {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead))
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const pad = (n: number) => String(n).padStart(2, "0")
  return { label: `${day} ${MONTHS[m]} ${y}`, validThrough: `${y}-${pad(m + 1)}-${pad(day)}T18:29:59.000Z` }
}
