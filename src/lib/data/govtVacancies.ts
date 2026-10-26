/**
 * Realistic vacancy counts for government notifications.
 * Fixes TBA / missing values and bumps unrealistically low counts (e.g. 1–2).
 */
import type { GovtJob } from "@/types/govtJob"

export function parseVacancyCount(raw?: string): number | null {
  if (!raw || /^tba$/i.test(raw.trim()) || raw === "-") return null
  const n = parseInt(String(raw).replace(/,/g, ""), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

type VacancyProfile = { min: number; typical: number; max: number }

function profileFor(job: Partial<GovtJob>): VacancyProfile {
  const hay = `${job.title} ${job.org} ${job.post} ${job.department || ""}`.toLowerCase()

  if (/upsc|ias|ips|ifs|civil service|nda|cds/.test(hay)) return { min: 400, typical: 1059, max: 1800 }
  if (/constable|gd|tradesman|capf|crpf|bsf|cisf|itbp|police|rpf|agniveer/.test(hay)) return { min: 2500, typical: 12000, max: 52000 }
  if (/railway|rrb|rrc|ntpc|group d|alp|technician|apprentice/.test(hay)) return { min: 800, typical: 6500, max: 35000 }
  if (/bank|sbi|ibps|rbi|clerk|po|probationary|credit officer/.test(hay)) return { min: 500, typical: 4500, max: 18000 }
  if (/ssc|cgl|chsl|mts|stenographer|je|junior engineer|ae|assistant engineer/.test(hay)) return { min: 350, typical: 4200, max: 25000 }
  if (/teacher|tet|ctet|kvs|nvs|lecturer|faculty|professor/.test(hay)) return { min: 1200, typical: 8500, max: 45000 }
  if (/navy|army|air force|iaf|afcat|defence|drdo/.test(hay)) return { min: 150, typical: 850, max: 3500 }
  if (/psu|ongc|ntpc|bhel|gail|iocl|coal india/.test(hay)) return { min: 200, typical: 1800, max: 8000 }
  if (/admit|result|answer|syllabus|key/.test(hay)) return { min: 500, typical: 3500, max: 40000 }

  return { min: 250, typical: 1200, max: 6000 }
}

/** Stable numeric seed from job id/title for deterministic vacancy assignment. */
function stableSeed(job: Partial<GovtJob>): number {
  const s = job.id || job.title || "govt"
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function resolveGovtVacancyCount(job: Partial<GovtJob>): number {
  const parsed = parseVacancyCount(job.vacancies)
  // Use the real official count as-is when present — never clamp it to a
  // keyword profile (clamping previously inflated low counts to a minimum and
  // truncated large ones). The profile spread is only a deterministic
  // placeholder for demo rows that have no real number (e.g. "TBA" / "0").
  if (parsed !== null) return parsed
  const profile = profileFor(job)
  const seed = stableSeed(job)
  return profile.typical + (seed % (profile.max - profile.min + 1))
}

/**
 * Tabs that represent open/forthcoming recruitment and therefore carry real
 * vacancies. Results, admit cards and answer keys are post-application stages
 * with no new vacancies, so they are excluded from vacancy totals.
 */
export function isVacancyBearingJob(job: Pick<GovtJob, "tab">): boolean {
  return job.tab === "latest" || job.tab === "upcoming"
}

export function formatVacancyCount(n: number): string {
  return n.toLocaleString("en-IN")
}

/** Split total posts across post names; each line gets a realistic share (min 80). */
export function buildVacancyBreakup(
  post: string,
  total: number,
  qualification?: string,
): { post: string; total: string; eligibility?: string }[] {
  const names = post
    .split(/[,/&]+|\band\b/gi)
    .map(p => p.trim())
    .filter(p => p.length > 2)
  const posts = names.length >= 2 ? names.slice(0, 6) : [post || "General Posts", "Other Posts"]
  const minPer = Math.max(80, Math.floor(total * 0.08))
  const weights = posts.map((_, i) => 1 + (i === 0 ? 0.4 : 0) + (stableSeed({ id: post }) + i) % 5)
  const weightSum = weights.reduce((a, b) => a + b, 0)
  let allocated = 0
  const rows = posts.map((name, i) => {
    const isLast = i === posts.length - 1
    const share = isLast
      ? Math.max(minPer, total - allocated)
      : Math.max(minPer, Math.round((total * weights[i]) / weightSum))
    allocated += share
    return { post: name, total: formatVacancyCount(share), eligibility: qualification }
  })
  const sum = rows.reduce((s, r) => s + parseVacancyCount(r.total)!, 0)
  if (sum !== total && rows.length) {
    const diff = total - sum
    const last = rows[rows.length - 1]
    const adj = parseVacancyCount(last.total)! + diff
    last.total = formatVacancyCount(Math.max(minPer, adj))
  }
  return rows
}

function normalizeBreakupRows(
  breakup: { post: string; total: string; eligibility?: string }[],
  total: number,
  post: string,
  qualification?: string,
): { post: string; total: string; eligibility?: string }[] {
  const minPer = 80
  const parsed = breakup.map(r => ({
    ...r,
    n: parseVacancyCount(r.total) ?? 0,
  }))
  const needsFix =
    parsed.length === 0 ||
    parsed.some(r => r.n < minPer) ||
    parsed.reduce((s, r) => s + r.n, 0) < Math.floor(total * 0.85)
  if (!needsFix) {
    return breakup.map(r => ({ ...r, total: formatVacancyCount(parseVacancyCount(r.total) || minPer) }))
  }
  return buildVacancyBreakup(post, total, qualification)
}

/**
 * Apply vacancy count + optional break-up table to a job record.
 *
 * synthesize=true (default): demo/fallback behaviour — fabricate a deterministic
 *   keyword-profile count + break-up when the source gives no real number.
 * synthesize=false: REAL ingested jobs — never invent a number. Use the source's
 *   parseable count as-is, otherwise store "Not Specified" with no break-up.
 */
export function applyGovtVacancies<T extends Partial<GovtJob>>(
  job: T,
  opts?: { synthesize?: boolean },
): T {
  if (opts?.synthesize === false) {
    const parsed = parseVacancyCount(job.vacancies)
    const vacancies = parsed === null ? "Not Specified" : formatVacancyCount(parsed)
    const vacancyBreakup = job.vacancyBreakup?.length ? job.vacancyBreakup : []
    return { ...job, vacancies, vacancyBreakup }
  }
  const total = resolveGovtVacancyCount(job)
  const vacancies = formatVacancyCount(total)
  const vacancyBreakup = job.vacancyBreakup?.length
    ? normalizeBreakupRows(job.vacancyBreakup, total, job.post || "", job.qualification)
    : buildVacancyBreakup(job.post || "Various Posts", total, job.qualification)
  return { ...job, vacancies, vacancyBreakup }
}


/* ------------------------------------------------------------------ */
/* Evidence gate: may a stored vacancy figure be ADDED UP?              */
/* ------------------------------------------------------------------ */

/**
 * Why this exists. A scraped notice can carry a number that no source document states: JNU Advt RC/75/2026 was stored
 * with "42,564" vacancies, but the official notice lists 122 faculty posts and states NO total (the figure appears
 * nowhere in it), and that one row made a hub-wide "42,566 Vacancies" headline. A total that adds up an unsupported
 * number is itself unsupported.
 *
 * WHAT COUNTS AS EVIDENCE — only fields whose contract is documented (migration 20260727000001):
 *   • verified_at  "When the record was last confirmed against the official source."
 *   • verified_by  "Admin user id, or ingestion:<adapter>."
 *   • content_changed_at is bumped by a trigger whenever a PUBLIC column — `vacancies` included — changes value;
 *     verified_* are deliberately NOT public content, so recording a verification never moves it.
 * A figure is therefore affirmatively verified only when ALL of:
 *   1. `verifiedAt` is a real timestamp that is not in the future;
 *   2. `verifiedBy` names a verifier, and it is NOT an automated `ingestion:<adapter>` confirmation — the adapter that
 *      scraped the number cannot vouch for it (JNU's came through exactly such an adapter);
 *   3. the verification is not older than the last content change (`contentChangedAt <= verifiedAt`), i.e. the stored
 *      figure was not altered after a person confirmed it; a missing `contentChangedAt` cannot show that → unverified.
 * Nothing else is evidence. In particular NOT: a clean-looking `post` string, the figure merely being parseable
 * (`vacanciesStated`), an official/notification URL, `status = active`, `review_status = approved`, a recent insert, the
 * curated seed marker, or a `vacancy_breakup` (the code builds those from the total).
 *
 * `post` text is kept ONLY as a negative screen: an obvious scraped fragment ("…cadres at any level. (ii)", table-header
 * noise) vetoes the figure even for a verified record, so a bad extraction is fixed in the data rather than trusted.
 *
 * Nothing is deleted, hidden or rewritten: the row stays listed, only the arithmetic over its figure is withheld.
 */
const POST_ENUMERATOR_TAIL = /\(\s*(?:[ivxlc]+|[a-z]|\d{1,2})\s*\)\s*\.?\s*$/i
const POST_LABEL_NOISE = /\b(closing\s+date|last\s+date|click\s+here|apply\s+online|download|advertisement)\b/i
const AUTOMATED_VERIFIER = /^\s*ingestion\s*:/i

/** True for an OBVIOUS scraped fragment. Missing / empty text is not a fragment (it is simply no evidence either way). */
export function isObviousScrapedFragment(post: unknown): boolean {
  if (typeof post !== "string") return false
  const t = post.trim()
  if (!t) return false
  return t.length > 120 || /^[a-z]/.test(t) || POST_ENUMERATOR_TAIL.test(t) || POST_LABEL_NOISE.test(t)
}

/** Postgres timestamptz text ("2026-06-12 15:29:28.905178+00") or ISO → ms, or NaN. */
function tsOf(raw: unknown): number {
  if (typeof raw !== "string" || !raw.trim()) return NaN
  const iso = raw.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")
  return Date.parse(iso)
}

/** The fields a vacancy figure is judged on. */
export type VacancyEvidence = Pick<GovtJob, "vacancies"> &
  Partial<Pick<GovtJob, "post" | "verifiedAt" | "verifiedBy" | "contentChangedAt">>

export type VacancyVerdict =
  | "no-figure"            // TBA / absent / 0: nothing is claimed, so nothing needs support
  | "verified"             // affirmative, current, non-automated verification
  | "unverified"           // a figure with no verification record
  | "automated-verification" // confirmed only by an ingestion adapter
  | "stale-verification"   // verified, but the record changed afterwards (or cannot be shown unchanged)
  | "scraped-fragment"     // the post text is an obvious extraction fragment

export function vacancyVerdict(job: VacancyEvidence, now: Date = new Date()): VacancyVerdict {
  if (parseVacancyCount(job.vacancies) === null) return "no-figure"
  if (isObviousScrapedFragment(job.post)) return "scraped-fragment"
  const verifiedMs = tsOf(job.verifiedAt)
  if (!Number.isFinite(verifiedMs) || verifiedMs > now.getTime() + 5 * 60_000) return "unverified"
  const by = typeof job.verifiedBy === "string" ? job.verifiedBy.trim() : ""
  if (!by) return "unverified"
  if (AUTOMATED_VERIFIER.test(by)) return "automated-verification"
  const changedMs = tsOf(job.contentChangedAt)
  if (!Number.isFinite(changedMs) || changedMs > verifiedMs) return "stale-verification"
  return "verified"
}

/** May this row's figure contribute to an aggregate? (A row that claims no figure never blocks one.) */
export function isSubstantiatedVacancy(job: VacancyEvidence, now?: Date): boolean {
  const v = vacancyVerdict(job, now)
  return v === "no-figure" || v === "verified"
}

/** False when ANY figure-bearing row in the set lacks affirmative evidence: the set's total must then not be shown at all. */
export function hasSupportedVacancyAggregate(jobs: VacancyEvidence[], now?: Date): boolean {
  return jobs.every(j => isSubstantiatedVacancy(j, now))
}

/**
 * Sum of REAL, parseable, VERIFIED vacancy counts — never a keyword-profile spread, an estimate, or a partial sum.
 * Fail closed: if any figure in the set is unsupported (see above) the whole aggregate is withheld and this returns 0,
 * which every display treats as "no total" and OMITS (never "0 Vacancies"). "TBA"/"-"/"0" contribute nothing and do not
 * themselves withhold an otherwise supported total. Use `aggregateVacancies` where 0 and "withheld" must differ.
 */
export function sumRealVacancies(jobs: VacancyEvidence[], now?: Date): number {
  return aggregateVacancies(jobs, now) ?? 0
}

/** The supported total, or null when it is withheld (an unsupported figure) or there is nothing to add up. */
export function aggregateVacancies(jobs: VacancyEvidence[], now?: Date): number | null {
  if (!hasSupportedVacancyAggregate(jobs, now)) return null
  const total = jobs.reduce((s, j) => s + (parseVacancyCount(j.vacancies) ?? 0), 0)
  return total > 0 ? total : null
}
