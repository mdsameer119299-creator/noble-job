/**
 * postingDate.ts — the ONE place that decides what may become JobPosting
 * `datePosted`.
 *
 * Google defines `datePosted` as the ORIGINAL date the employer posted the job.
 * NobleJob therefore emits it only from a field that stores exactly that:
 *
 *   private / WFH / abroad  →  `source_posted_at`   (employer / source publication date)
 *   government              →  `source_published_at` (the official source's publication date)
 *
 * It is NEVER derived from any of these, however convenient:
 *   • `posted_at`             — NobleJob row creation time (`DEFAULT NOW()`); for a
 *                               sourced/aggregated job it is the ingestion time
 *   • `created_at` / `updated_at` / `fetched_at`
 *   • `last_confirmed_open_at`, `review_due_at`, `content_changed_at`, `closed_at`
 *   • `job.posted` / display strings ("5 days ago", "Recent")
 *   • the current time
 *
 * If the record has no genuine source publication date, the answer is `undefined`
 * and the caller emits NO JobPosting — we never substitute a date.
 *
 * The visible "Posted …" date on pages is a separate concern and is unchanged.
 */
import { parseRealDate } from "./jobPostingRules"

export type PostingDateBoard = "private" | "wfh" | "abroad" | "govt"

/** Column that carries the original publication date, per board. */
export const SOURCE_DATE_FIELD: Record<PostingDateBoard, "source_posted_at" | "source_published_at"> = {
  private: "source_posted_at",
  wfh: "source_posted_at",
  abroad: "source_posted_at",
  govt: "source_published_at",
}

/** A source date more than this far in the future is bad data, not a date. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000

/** Loose record: only the source-date fields are read, by design. */
export interface SourceDated {
  source_posted_at?: string | null
  sourcePostedAt?: string | null
  source_published_at?: string | null
  sourcePublishedAt?: string | null
}

/**
 * The genuine ORIGINAL publication date (ISO) of a record, or `undefined` when the
 * record does not carry one, it is unparseable, or it lies in the future.
 */
export function originalPostingDate(
  rec: SourceDated | null | undefined,
  board: PostingDateBoard,
  now: Date = new Date(),
): string | undefined {
  if (!rec) return undefined
  const raw =
    board === "govt"
      ? rec.sourcePublishedAt ?? rec.source_published_at
      : rec.sourcePostedAt ?? rec.source_posted_at
  const iso = parseRealDate(raw)
  if (!iso) return undefined
  if (new Date(iso).getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return undefined
  return iso
}
