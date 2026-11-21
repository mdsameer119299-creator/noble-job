/**
 * limits.ts — single source of truth for how much resume-related text the server will process.
 *
 * Why these exist: scoring runs on the main Node thread of a single long-lived process. Every
 * regex in the scoring path is now linear-time (see linearScan.ts), but the caps below are the
 * second, independent layer: no matter what a future regex does, the input it sees is bounded.
 */

/** Max characters of resume text that is ever scored. A 15-page resume is ~50k characters. */
export const RESUME_MAX_TEXT_CHARS = 100_000

/** Max characters of a job description used for keyword matching (the AI prompt uses ≤ 2,000). */
export const JOB_DESCRIPTION_MAX_CHARS = 20_000

/** Max bytes of the candidate scorer's JSON body: text (≤ 100k chars, ≤ 4 bytes each) + JD + slack. */
export const CANDIDATE_SCORE_BODY_MAX_BYTES = 512 * 1024

/** Max length of a job id passed to the candidate scorer. */
export const JOB_ID_MAX_CHARS = 100

/** Wall-clock budget for receiving an upload / JSON body once the handler is reading it. */
export const BODY_READ_TIMEOUT_MS = 20_000

/** Truncate (never throw) to the resume text cap. Returns the possibly-shortened text. */
export function capResumeText(text: string): string {
  return text.length > RESUME_MAX_TEXT_CHARS ? text.slice(0, RESUME_MAX_TEXT_CHARS) : text
}

export const TEXT_TRUNCATED_WARNING = `Only the first ${RESUME_MAX_TEXT_CHARS.toLocaleString("en-US")} characters were analysed.`
