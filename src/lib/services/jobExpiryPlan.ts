/**
 * jobExpiryPlan.ts — the pure decision logic of the job expiry lifecycle.
 *
 *   open → review due → employer/source confirmation → still open
 *                                                   ↘ closed → JobPosting removed
 *
 * Two dates that must never be confused:
 *   application_deadline  the EMPLOYER's real closing date (the only source of
 *                         JobPosting `validThrough`). Never invented here.
 *   review_due_at         NobleJob's INTERNAL "is it still open?" review date.
 *                         Never a deadline, never published.
 *
 * `planLifecycleActions` only DECIDES; `scripts/run-job-lifecycle.ts` applies the
 * decisions to Supabase. Dependency-free so it is unit-testable.
 *
 * Closed rows leave the sitemap and lose their JobPosting on the next render
 * because `isOpen()` (src/lib/jobs/provenance.ts) is false for any non-`active`
 * status — no separate removal step is needed.
 */
import { isPast, parseRealDate } from "../seo/jobPostingRules"

export type LifecycleTable = "jobs" | "wfh_jobs" | "abroad_jobs"

export interface LifecycleRow {
  id: string
  status?: string | null
  posted_at?: string | null
  application_deadline?: string | null
  review_due_at?: string | null
  last_confirmed_open_at?: string | null
  closed_at?: string | null
}

export type CloseReason = "deadline_passed" | "unconfirmed_past_grace"

export type LifecycleAction =
  /** Employer's real deadline has passed → close. */
  | { kind: "close"; id: string; reason: CloseReason }
  /** No review date stored yet → set one (internal only). */
  | { kind: "schedule_review"; id: string; reviewDueAt: string }
  /** Review date has passed → needs employer/source confirmation (report only). */
  | { kind: "review_due"; id: string; reviewDueAt: string }

export interface LifecycleConfig {
  reviewIntervalDays: number
  /** Close jobs left unconfirmed this many days after review came due; undefined = never. */
  autoCloseGraceDays?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()
}

/**
 * When review should next be due for a row: its stored `review_due_at`, else the
 * interval after the last confirmation, else the interval after it was posted.
 * `undefined` when the row has no real date to count from (we do not guess).
 */
export function effectiveReviewDue(row: LifecycleRow, cfg: LifecycleConfig): string | undefined {
  const stored = parseRealDate(row.review_due_at)
  if (stored) return stored
  const from = parseRealDate(row.last_confirmed_open_at) ?? parseRealDate(row.posted_at)
  return from ? addDays(from, cfg.reviewIntervalDays) : undefined
}

export function planLifecycleActions(rows: LifecycleRow[], now: Date, cfg: LifecycleConfig): LifecycleAction[] {
  const out: LifecycleAction[] = []
  for (const row of rows) {
    if ((row.status ?? "").toLowerCase() !== "active") continue

    // 1. The employer's own deadline has genuinely passed → closed.
    const deadline = parseRealDate(row.application_deadline)
    if (deadline && isPast(deadline, now)) {
      out.push({ kind: "close", id: row.id, reason: "deadline_passed" })
      continue
    }

    // 2. Internal review cadence.
    const due = effectiveReviewDue(row, cfg)
    if (!due) continue
    if (!parseRealDate(row.review_due_at)) {
      out.push({ kind: "schedule_review", id: row.id, reviewDueAt: due })
    }
    if (isPast(due, now)) {
      const grace = cfg.autoCloseGraceDays
      if (grace !== undefined && isPast(addDays(due, grace), now)) {
        out.push({ kind: "close", id: row.id, reason: "unconfirmed_past_grace" })
      } else {
        out.push({ kind: "review_due", id: row.id, reviewDueAt: due })
      }
    }
  }
  return out
}

/** Column update that records "the employer/source confirmed this is still open". */
export function buildConfirmOpenUpdate(now: Date, cfg: LifecycleConfig) {
  const at = now.toISOString()
  return {
    last_confirmed_open_at: at,
    review_due_at: addDays(at, cfg.reviewIntervalDays),
  }
}

/** Column update that closes a job. Never touches `application_deadline`. */
export function buildCloseUpdate(now: Date) {
  return { status: "closed" as const, closed_at: now.toISOString() }
}
