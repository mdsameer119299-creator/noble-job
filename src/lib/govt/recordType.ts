/**
 * recordType.ts — what KIND of government record a govt_jobs row is.
 *
 * The government board mixes real recruitment notifications with admit cards,
 * results, answer keys, cut-offs, syllabi and previous papers. Only a
 * recruitment NOTIFICATION is a job opening; the others are informational and
 * must never carry JobPosting structured data.
 *
 * The stored `govt_jobs.record_type` column wins when present and valid. When it
 * is absent (rows written before the column existed, or an unmigrated database)
 * the type is DERIVED with the same rules as the SQL backfill in
 * `supabase/migrations/20260727000001_govt_jobs_record_integrity.sql`. Keep the
 * two in sync — `recordType.test.ts` pins the TypeScript side.
 *
 * Dependency-free so it can be unit-tested without the Next runtime.
 */

export type GovtRecordType =
  | "notification"
  | "admit_card"
  | "result"
  | "answer_key"
  | "cutoff"
  | "syllabus"
  | "previous_paper"
  | "other"

export const GOVT_RECORD_TYPES: readonly GovtRecordType[] = [
  "notification",
  "admit_card",
  "result",
  "answer_key",
  "cutoff",
  "syllabus",
  "previous_paper",
  "other",
]

export function isGovtRecordType(v: unknown): v is GovtRecordType {
  return typeof v === "string" && (GOVT_RECORD_TYPES as readonly string[]).includes(v)
}

/** Only a recruitment notification may emit JobPosting. */
export function canEmitJobPosting(t: GovtRecordType): boolean {
  return t === "notification"
}

/**
 * A current recruitment notification must pass a freshness check: it must have
 * been published (or, when no source-stated publication date is available,
 * ingested) within the last year. The publication date is always preferred, but
 * many legitimate adapters (IBPS, UPPSC, most PDF-feed adapters) cannot extract
 * one, so `created_at` (the database insertion timestamp) serves as a fallback.
 *
 * Without this fallback every row whose adapter doesn't extract a date would be
 * invisible — which is exactly the production bug this fixes: 141 active,
 * approved, published rows were hidden because ALL had `source_published_at`
 * NULL. The year-wide window is deliberately conservative: long-running
 * recruitment cycles remain eligible, while genuinely old legacy records do not.
 */
const CURRENT_NOTIFICATION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

/** Shape accepted by `isCurrentGovtNotification`. */
interface CurrentNotificationInput {
  recordType?: unknown
  record_type?: unknown
  tab?: unknown
  title?: unknown
  sourcePublishedAt?: unknown
  source_published_at?: unknown
  /** Fallback timestamp: the row's database insertion time (snake_case from Supabase). */
  created_at?: unknown
  /** Fallback timestamp: camelCase alias used in mapped objects. */
  createdAt?: unknown
}

export function isCurrentGovtNotification(job: CurrentNotificationInput): boolean
export function isCurrentGovtNotification(job: CurrentNotificationInput, now: Date): boolean
export function isCurrentGovtNotification(
  job: CurrentNotificationInput,
  now: Date = new Date(),
): boolean {
  const recordType = typeof job.recordType === "string" ? job.recordType : undefined
  const record_type = typeof job.record_type === "string" ? job.record_type : undefined
  const tab = typeof job.tab === "string" ? job.tab : undefined
  const title = typeof job.title === "string" ? job.title : undefined
  if (govtRecordTypeOf({ recordType, record_type, tab, title }) !== "notification") return false

  // Prefer source_published_at (trustworthy); fall back to created_at (ingestion time).
  const raw = typeof job.sourcePublishedAt === "string"
    ? job.sourcePublishedAt
    : typeof job.source_published_at === "string"
      ? job.source_published_at
      : typeof job.created_at === "string"
        ? job.created_at
        : typeof job.createdAt === "string"
          ? job.createdAt
          : undefined
  if (!raw) return false
  const ts = new Date(raw)
  if (Number.isNaN(ts.getTime())) return false
  const age = now.getTime() - ts.getTime()
  return age >= 0 && age <= CURRENT_NOTIFICATION_MAX_AGE_MS
}

/** `tab` values whose rows are recruitment notifications (not informational). */
const NOTIFICATION_TABS = new Set(["latest", "railway", "banking", "ssc", "upsc", "state", "psu"])

const RECRUITMENT_WORDS = /\b(recruitment|vacanc\w*|apply|notification)\b/i

/**
 * Derive a record type from `tab` + `title`. Mirrors the SQL backfill.
 * `upcoming` and `scholarships` rows are `other`: an upcoming notification is not
 * yet accepting applications, and a scholarship is not a job.
 */
export function deriveRecordType(input: { tab?: string | null; title?: string | null }): GovtRecordType {
  const tab = (input.tab ?? "").toLowerCase()
  const title = input.title ?? ""

  if (tab === "results") return "result"
  if (tab === "admit") return "admit_card"
  if (tab === "answer") return "answer_key"
  if (tab === "syllabus") return "syllabus"

  // A misfiled informational row (e.g. an answer key on the "latest" tab).
  if (/\banswer\s*keys?\b/i.test(title)) return "answer_key"
  if (/\b(admit\s*card|hall\s*ticket|call\s*letter)\b/i.test(title)) return "admit_card"
  if (/\bcut[\s-]?off\b/i.test(title)) return "cutoff"
  if (/\b(result|merit\s*list|score\s*card|scorecard)\b/i.test(title)) return "result"
  if (/\bprevious\s+(year\s+)?(question\s+)?papers?\b/i.test(title)) return "previous_paper"
  if (/\bsyllabus\b/i.test(title) && !RECRUITMENT_WORDS.test(title)) return "syllabus"

  if (NOTIFICATION_TABS.has(tab)) return "notification"
  return "other"
}

/** Stored type when valid, otherwise derived. */
export function govtRecordTypeOf(job: {
  recordType?: unknown
  record_type?: unknown
  tab?: unknown
  title?: unknown
}): GovtRecordType {
  const stored = typeof job.recordType === "string" ? job.recordType : typeof job.record_type === "string" ? job.record_type : undefined
  if (isGovtRecordType(stored)) return stored
  return deriveRecordType({
    tab: typeof job.tab === "string" ? job.tab : undefined,
    title: typeof job.title === "string" ? job.title : undefined,
  })
}
