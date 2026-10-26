/**
 * salaryRange.ts — ONE rule for turning a source's numeric salary bounds into display text.
 *
 * Why this exists. Three ingest/service formatters each did `$${Math.round(n / 1000)}K`, so a source that
 * publishes a SMALL non-zero figure (an hourly/daily rate, a placeholder like 100–400) rendered as
 * "$0K-$0K/yr" on a card. A range whose amounts round to zero is not a salary; it is an artefact.
 *
 * Rule: a bound counts only when it is a finite number > 0. The range is shown only when EVERY bound that
 * is present also formats to something non-zero. Anything else → "" (unavailable): the caller hides the
 * salary instead of inventing a replacement ("Competitive", "Negotiable", a made-up figure).
 *
 * Pure: no server / Next imports, so ingest code, services and tests share the exact same function.
 */

const isPositiveAmount = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0

/** True when formatted text contains no non-zero digit ("$0K", "₹0L", "USD 0K"). */
const formatsToZero = (text: string): boolean => !/[1-9]/.test(text)

/**
 * "<lo>-<hi>/yr", "<amount>/yr" or "" (unavailable).
 *   • missing / zero / negative / NaN / non-number bounds are ignored (a one-sided range stays one-sided);
 *   • if NO bound is usable → "";
 *   • if any usable bound formats to zero (e.g. 300 → "$0K") the source's figures are not annual amounts
 *     we can show → "" (never "$0K-$80K/yr", which would invent a floor of zero).
 */
export function formatSalaryRange(min: unknown, max: unknown, fmt: (n: number) => string): string {
  const lo = isPositiveAmount(min) ? fmt(min) : ""
  const hi = isPositiveAmount(max) ? fmt(max) : ""
  if ((lo && formatsToZero(lo)) || (hi && formatsToZero(hi))) return ""
  if (lo && hi) return `${lo}-${hi}/yr`
  const one = lo || hi
  return one ? `${one}/yr` : ""
}

/**
 * Salary DISPLAY text that is only a placeholder of zeros — "$0K-$0K/yr", "₹0L", "USD 0K - USD 0K / yr",
 * "0-0", "$0" — as already stored in a row by an earlier formatter. Never matches a figure with any
 * non-zero digit ("$10K", "₹0.5L", "0 openings" is not a salary-shaped value either).
 */
const ZERO_SALARY_RE = /^[\s$₹€£A-Za-z]*0+(?:\.0+)?\s*[KkLlMm]?\+?(?:\s*(?:[-–—]|to)\s*[\s$₹€£A-Za-z]*0+(?:\.0+)?\s*[KkLlMm]?\+?)?\s*(?:\/\s*(?:yr|year|annum|mo|month|hr|hour|day|week))?\s*$/i

export function isZeroSalaryText(raw: unknown): boolean {
  if (typeof raw !== "string") return false
  const t = raw.trim()
  if (!t || /[1-9]/.test(t)) return false
  return ZERO_SALARY_RE.test(t)
}
