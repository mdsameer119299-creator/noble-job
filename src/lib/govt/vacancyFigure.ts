/**
 * vacancyFigure.ts — may a stored vacancy figure be SHOWN for one government notification?
 *
 * Plain, dependency-free TypeScript (no Next / React / Supabase imports) so the rule is unit-testable and can sit in the
 * one mapper every route reads through (`mapRow`) as well as in the components that print a figure.
 *
 * WHY. A scraped notice can store a number that its source document never states. Two live rows were checked against
 * their official notices on 2026-10-28 (see REVIEWED_NOTICES):
 *   • JNU Advt RC/75/2026 is stored with 42,564 vacancies (a "17,526 + 25,038" break-up). The official notice lists
 *     faculty posts and states NO total; none of those three numbers appears in it.
 *   • DRDO RAC Advt 152 is stored with 2 vacancies. The official advertisement could not be read by the audit tooling
 *     (the site disallows automated fetches) and the public Advt 152 schedule page states no count, so the figure is
 *     UNCONFIRMED — and it is never invented or replaced.
 * The homepage/hub aggregate was already withheld (govtVacancies.ts `vacancyVerdict`); this module closes the
 * per-record routes: title, metadata, hero chip, quick facts, vacancy table, stored overview / article / FAQ text,
 * JobPosting description and the cards.
 *
 * THE RULE (display of ONE record's figure). A figure is NOT shown when
 *   1. the record has an entry in REVIEWED_NOTICES whose finding is that the notice does not support it, or
 *   2. its `post` is an obvious scraped fragment (`isObviousScrapedFragment`: a sentence tail like "…at any level. (ii)",
 *      or table-header noise like "… Closing date of Advertisement") — the same negative screen the aggregate gate uses.
 * Every other stored figure is shown as before (aggregates remain fail-closed: they need a verified record).
 *
 * Nothing is deleted or rewritten in the database; suppression happens when a row is mapped for display.
 */
import { isObviousScrapedFragment, parseVacancyCount } from "@/lib/data/govtVacancies"

/** What the audit found when the stored figure was compared with the official notice. */
export interface ReviewedNotice {
  /** Day the notice was checked (YYYY-MM-DD). */
  checkedOn: string
  /** Public URL of the official notice that was consulted. */
  notice: string
  /** "not-stated": the notice contains no such figure. "unconfirmed": the notice could not be read / does not settle it. */
  figure: "not-stated" | "unconfirmed"
  /** One line: what was found. */
  finding: string
  /**
   * The closing date the notice states ("DD Mon YYYY"). Used ONLY when the stored last date is a placeholder ("TBA", "-",
   * empty) — a real stored date is never overridden.
   */
  closingDate?: string
}

export const REVIEWED_NOTICES: Readonly<Record<string, ReviewedNotice>> = {
  "jnu:jnu-rc-75-2026": {
    checkedOn: "2026-10-28",
    notice: "https://www.jnu.ac.in/sites/default/files/inline-files/JNU_AdvtNo_RC_75_2026.pdf",
    figure: "not-stated",
    finding:
      "Advertisement No. RC/75/2026 lists faculty posts and states no total or per-post vacancy count; 17,526, 25,038 and 42,564 do not appear in it. " +
      "Applications are accepted from 18-MAY-2026 until 15-JUNE-2026, 5:00 PM.",
    closingDate: "15 Jun 2026",
  },
  "drdo-rac:drdo-rac-152": {
    checkedOn: "2026-10-28",
    notice: "https://rac.gov.in/download/advt_152.pdf",
    figure: "unconfirmed",
    finding:
      "The advertisement PDF could not be read (the site disallows automated fetches) and the public Advt 152 schedule page states no vacancy count; " +
      "the stored figure of 2 is therefore unconfirmed and is not shown. No replacement figure is offered.",
  },
}

type FigureLike = { id?: string; vacancies?: string; post?: string }

export type SuppressionReason = "reviewed-notice" | "scraped-fragment"

/** Why this record's figure must not be shown, or null when it may be (also null when there is no figure at all). */
export function vacancySuppression(job: FigureLike): SuppressionReason | null {
  if (parseVacancyCount(job.vacancies) === null) return null
  if (job.id && Object.prototype.hasOwnProperty.call(REVIEWED_NOTICES, job.id)) return "reviewed-notice"
  if (isObviousScrapedFragment(job.post)) return "scraped-fragment"
  return null
}

/**
 * The vacancy figure to DISPLAY for this record ("11,558"), or undefined — never "Not Specified", "TBA", "0" or a
 * suppressed figure. Every place that prints a count (title, description, chip, quick fact, card) goes through this.
 */
export function displayVacancies(job: FigureLike): string | undefined {
  if (parseVacancyCount(job.vacancies) === null) return undefined
  if (vacancySuppression(job)) return undefined
  return String(job.vacancies).trim()
}

/** The closing date to show: the stored one, or — only when that is a placeholder — the one a reviewed notice states. */
export function reviewedClosingDate(id: string | undefined, stored: string | null | undefined): string | undefined {
  const s = (stored ?? "").trim()
  if (s && !/^(tba|-|—|n\/?a|not (?:specified|available))$/i.test(s)) return s
  const r = id && Object.prototype.hasOwnProperty.call(REVIEWED_NOTICES, id) ? REVIEWED_NOTICES[id].closingDate : undefined
  return r ?? (s || undefined)
}

/* ------------------------------------------------------------------ */
/* Scrubbing a suppressed figure out of stored free text                */
/* ------------------------------------------------------------------ */

const NO_FIGURE_ANSWER = "The number of vacancies is not confirmed on this page. Please refer to the official notification."
const VACANCY_WORDS = /\b(?:vacanc(?:y|ies)|posts?|openings?|positions?|seats?)\b/i

/** A regex for the number `n` as printed with or without thousands separators, not part of a longer number. */
function figureRegex(digits: string): RegExp {
  const body = digits.split("").join(",?")
  return new RegExp(`(?<![\\d,.])${body}(?![\\d]|,\\d)`)
}

function figureDigits(raw: unknown): string | null {
  const n = parseVacancyCount(typeof raw === "string" ? raw : undefined)
  return n === null ? null : String(n)
}

/** True when the sentence states one of the figures as a count (the number AND a vacancy/post word). */
function sentenceStatesFigure(sentence: string, figures: RegExp[]): boolean {
  return VACANCY_WORDS.test(sentence) && figures.some(f => f.test(sentence))
}

/** A bare list marker such as "(ii)." — what is left behind when a scraped sentence is cut at its enumerator. */
const ENUMERATOR_ONLY = /^\(\s*(?:[ivxlc]+|[a-z]|\d{1,2})\s*\)\s*\.?$/i

/** Remove every sentence that states one of `figures` as a count. Paragraph (line) structure is kept. */
export function scrubFigureSentences(text: string, figures: string[]): string {
  const res = figures.map(figureDigits).filter((d): d is string => !!d).map(figureRegex)
  if (!res.length) return text
  return text
    .split("\n")
    .map(line => {
      let removedPrev = false
      const kept: string[] = []
      for (const s of line.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)) {
        if (sentenceStatesFigure(s, res)) { removedPrev = true; continue }
        if (removedPrev && ENUMERATOR_ONLY.test(s.trim())) continue // the "(ii)." tail of the removed sentence
        removedPrev = false
        kept.push(s)
      }
      return kept.join(" ")
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

interface Scrubbable {
  vacancies: string
  vacanciesStated?: string
  vacancyBreakup?: { post: string; total: string; eligibility?: string }[]
  overview?: string
  article?: string
  faqs?: { q: string; a: string }[]
}

/**
 * Take a suppressed figure (and every break-up total built from it) out of a record. The row stays; it simply claims
 * no count: `vacancies` becomes "Not Specified", the break-up table is dropped, stored prose loses the sentences that
 * state the number, and an FAQ answer that states it is replaced by a neutral pointer to the official notification.
 */
export function withoutVacancyFigure<T extends Scrubbable>(job: T): T {
  const figures = [job.vacancies, ...(job.vacancyBreakup ?? []).map(r => r.total)]
  const res = figures.map(figureDigits).filter((d): d is string => !!d).map(figureRegex)
  const patch: Partial<Scrubbable> = { vacancies: "Not Specified", vacanciesStated: undefined, vacancyBreakup: [] }
  if (typeof job.overview === "string") patch.overview = scrubFigureSentences(job.overview, figures) || undefined
  if (typeof job.article === "string") patch.article = scrubFigureSentences(job.article, figures) || undefined
  if (job.faqs?.length) {
    patch.faqs = job.faqs.map(f => (sentenceStatesFigure(f.a, res) || sentenceStatesFigure(f.q, res) ? { q: f.q, a: NO_FIGURE_ANSWER } : f))
  }
  return { ...job, ...patch } as T
}

/**
 * The display gate applied once, where a stored row becomes a GovtJob: suppress an unsupported figure and fill a
 * placeholder closing date from a reviewed notice. Pure; returns the same object when nothing applies.
 */
export function applyVacancyDisplayGate<
  T extends Scrubbable & { id?: string; post?: string; lastDate?: string; last_date?: string },
>(job: T): T {
  let out: T = job
  if (vacancySuppression(job)) out = withoutVacancyFigure(out)
  const stored = job.lastDate ?? job.last_date
  const date = reviewedClosingDate(job.id, stored)
  if (date && date !== stored) out = { ...out, lastDate: date, last_date: date }
  return out
}
