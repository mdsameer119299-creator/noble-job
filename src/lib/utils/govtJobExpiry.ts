/**
 * Expiry helpers for government job notifications.
 *
 * Government jobs store their closing date as a plain text string in the format
 * "DD MMM YYYY" (e.g. "08 Jun 2026"). Special placeholder values "TBA" and "-"
 * indicate unknown or not-applicable dates and must never be treated as expired.
 *
 * A job is considered expired only when its lastDate is strictly before the
 * start of today's date (midnight local time), so a job closing *today* is
 * still visible to users throughout the day.
 */
import { parse, isBefore, startOfToday } from "date-fns"

/**
 * Parses a government job lastDate string into a Date object.
 * Returns null for placeholders ("TBA", "-") or unparseable strings.
 */
export function parseLastDate(raw: string | null | undefined): Date | null {
  if (!raw || raw === "TBA" || raw === "-") return null
  const d = parse(raw.trim(), "dd MMM yyyy", new Date())
  return isNaN(d.getTime()) ? null : d
}

/**
 * Returns true only when the job's lastDate is a valid date that has already
 * passed (strictly before today midnight). Unknown dates ("TBA", "-") and
 * future dates both return false so the job remains visible.
 */
export function isGovtJobExpired(lastDate: string | null | undefined): boolean {
  const d = parseLastDate(lastDate)
  if (d === null) return false
  return isBefore(d, startOfToday())
}

/**
 * A job is "active" when it is not flagged expired AND its application window
 * has not closed. This is the exact predicate used to filter the govt job
 * listing, reused here so statistics never count expired notifications.
 */
export function isActiveGovtJob(job: { status?: string; lastDate?: string | null }): boolean {
  return job.status !== "expired" && !isGovtJobExpired(job.lastDate)
}
