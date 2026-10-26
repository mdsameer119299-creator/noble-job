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
 *   2. `verifiedBy` is an ADMINISTRATOR ID in the exact shape this repository records for an acting admin (see below) —
 *      not any non-empty string. `ingestion:<adapter>` is rejected explicitly (the adapter that scraped the number cannot
 *      vouch for it; JNU's came through exactly such an adapter), and so is every other label ("system", "manual",
 *      "unknown", an e-mail, a name, a malformed or nil UUID);
 *   3. the verification is STRICTLY later than the last content change (`contentChangedAt < verifiedAt`), i.e. the stored
 *      figure was not altered at or after the moment a person confirmed it. EQUAL timestamps are NOT accepted: Postgres
 *      NOW() is transaction-stable, so an edit and a verification written in one statement/transaction can carry the very
 *      same instant, and equality cannot show which came first. A missing `contentChangedAt` cannot show it either →
 *      stale. (JS Dates resolve milliseconds, Postgres microseconds: two instants inside one millisecond compare equal and
 *      are therefore treated as stale — fail-closed, and unreachable for a human verification.)
 *
 * THE ADMINISTRATOR-ID CONTRACT. In this repository an administrator is a row of `users` (id UUID PRIMARY KEY REFERENCES
 * auth.users(id)) with role = 'admin' and status = 'active'; `requireAdminApi()` (lib/auth/verifyAdminApi.ts) is the only
 * gate that establishes that, and it returns the Supabase auth `user`. Every existing admin audit column stores that value
 * verbatim (`admin_reviewed_by: auth.user?.id` in api/admin/application-review). So `verified_by` MUST be `auth.user.id`
 * — a canonical lowercase UUID — written by server code that has just passed `requireAdminApi()`.
 *
 * WHAT THIS PURE FUNCTION CAN AND CANNOT PROVE. It can prove the value has the admin-ID *shape*; it cannot prove the UUID
 * belongs to a live admin (that needs a database read), and a shape check never proves a human compared the figure with the
 * notice. The remaining guarantee is therefore the TRUSTED-WRITER contract, which is enforced rather than assumed:
 *   • `govt_jobs` has RLS with a single SELECT policy, so no browser/anon/authenticated client can write `verified_*`;
 *     only service-role server code can;
 *   • the only code permitted to write `verified_by` / `verified_at` is an admin-gated route (it must call
 *     `requireAdminApi()` and store `auth.user.id`); today NO code writes them, and ingestion must never. A static test
 *     (govtVacancyEvidence.test.ts, section C) fails if any other file starts writing those columns, and a checker
 *     (`checkVerificationWriter`, same file) requires an allowed writer to issue a single-row `.update()` whose payload is
 *     EXACTLY `verified_by` (= `auth.user.id`) and `verified_at` — no public field, no `content_changed_at`, no spread, no
 *     upsert/insert — so a verification can never ride along with a content edit;
 *   • the DATABASE enforces the same thing, whoever the caller is — migration 20261026000001 (a forward migration,
 *     prepared as a code artifact and NOT yet applied anywhere): `content_changed_at` is maintained by the trigger alone
 *     (a caller-supplied value is ignored; a public edit stamps clock_timestamp(), strictly after the previous stamp and any
 *     verification), a statement that edits public content cannot also record a verification (check_violation), `verified_at`
 *     is stamped from the database clock, and a row cannot be inserted already verified. UNTIL IT IS APPLIED the live trigger
 *     (20260727000001) still lets a writer that supplies its own `content_changed_at` bypass the stamp; this file's strict
 *     comparison closes only the equal-timestamp half of that gap. The order for a human: save the edit first, record the
 *     verification afterwards, as a separate statement.
 *
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
/**
 * The administrator-ID shape: a canonical, lowercase, hyphenated UUID of RFC 4122 version 1–8 and variant 8/9/a/b
 * (Supabase `auth.users.id` is gen_random_uuid(), i.e. v4, and `user.id` is returned in exactly this form). The nil
 * and max UUIDs fail the version/variant nibbles. No trimming and no case-folding: a padded, braced, upper-case or
 * prefixed value is not what the trusted writer stores, so it is not accepted.
 */
const ADMIN_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** True only for a value shaped like an administrator ID (`auth.users.id`). Shape only — see the contract above. */
export function isAdminUserId(v: unknown): v is string {
  return typeof v === "string" && ADMIN_USER_ID.test(v)
}

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
  | "invalid-verifier"     // verified_by is not an administrator ID ("system", "manual", "unknown", malformed, …)
  | "stale-verification"  // verified, but the record changed at/after it (or cannot be shown unchanged)
  | "scraped-fragment"     // the post text is an obvious extraction fragment

export function vacancyVerdict(job: VacancyEvidence, now: Date = new Date()): VacancyVerdict {
  if (parseVacancyCount(job.vacancies) === null) return "no-figure"
  if (isObviousScrapedFragment(job.post)) return "scraped-fragment"
  const verifiedMs = tsOf(job.verifiedAt)
  if (!Number.isFinite(verifiedMs) || verifiedMs > now.getTime() + 5 * 60_000) return "unverified"
  const raw = job.verifiedBy
  if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) return "unverified"
  if (typeof raw === "string" && AUTOMATED_VERIFIER.test(raw)) return "automated-verification"
  if (!isAdminUserId(raw)) return "invalid-verifier"
  const changedMs = tsOf(job.contentChangedAt)
  if (!Number.isFinite(changedMs) || changedMs >= verifiedMs) return "stale-verification"
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
