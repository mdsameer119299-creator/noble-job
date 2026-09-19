/**
 * jobMapper.ts — pure mapping of a raw `jobs` row (snake_case) to the public `Job`
 * shape. No Supabase / Next imports, so it is unit-testable and shared by the list
 * and detail reads.
 *
 * The old inline mapper turned a missing value into visible placeholder text
 * (`String(undefined)` → "undefined", location → "India", type → "Full Time",
 * apply URL → "#", salary → "Competitive" / "NaN", source → "Noble Job"). A record
 * with a missing field must be seen as missing — by the renderable gate — not
 * dressed up as a normal job. So this mapper NEVER invents a value: absent →
 * empty string, and the caller (`filterRenderable`) decides whether the record can
 * be shown at all.
 */
import { KNOWN_PROVENANCE, classifyProvenance } from "@/lib/jobs/provenance"
import type { Job, Provenance } from "@/types/job"

/** Trimmed string for a string/finite-number value; "" otherwise (never "undefined"/"null"). */
function s(v: unknown): string {
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return ""
}

/** "₹3.5-6 LPA" from annual min/max, or "" when the record states no usable salary. */
export function formatLpaRange(min: unknown, max: unknown): string {
  const a = Number(min)
  const b = Number(max)
  const okA = Number.isFinite(a) && a > 0
  const okB = Number.isFinite(b) && b > 0
  const lpa = (n: number) => String(Math.round((n / 100000) * 100) / 100)
  if (okA && okB) return `₹${lpa(a)}-${lpa(b)} LPA`
  if (okA) return `From ₹${lpa(a)} LPA`
  if (okB) return `Up to ₹${lpa(b)} LPA`
  return ""
}

/**
 * Raw columns that are safe to expose alongside the mapped fields (detail pages and
 * the JobPosting builder read them). An allow-list — NOT a blind row spread — so
 * internal columns (`review_due_at`, `last_confirmed_open_at`, `closed_at`, …) never
 * reach a public API response.
 */
const RAW_PASSTHROUGH = [
  "posted_at", "source_posted_at", "description", "job_type", "experience_required",
  "application_deadline", "salary_min", "salary_max", "apply_url", "status", "category",
  "is_verified", "is_featured",
] as const

export type PrivateJobRecord = Job & Record<string, unknown>

export function mapPrivateJobRow(row: Record<string, unknown>): PrivateJobRecord {
  const r = row
  const company = s(r.company)
  const explicit = String(r.provenance ?? "").toUpperCase()
  const id = s(r.id)

  const mapped: Job = {
    id,
    title: s(r.title),
    company,
    logo: company.slice(0, 2).toUpperCase(),
    color: "#1847d4",
    location: s(r.location),
    type: s(r.job_type),
    exp: s(r.experience_required),
    salary: s(r.salary) || formatLpaRange(r.salary_min, r.salary_max),
    cat: s(r.category),
    skills: Array.isArray(r.skills) ? (r.skills as unknown[]).map(s).filter(Boolean) : [],
    badge: s(r.badge) || undefined,
    jobStatus: (s(r.job_status) as Job["jobStatus"]) || (r.is_verified ? "VERIFIED_JOB" : "LIVE_JOB"),
    // A stored `provenance` wins; otherwise classify defensively (fail closed) so
    // every read is gate-ready. Legacy rows without evidence resolve to UNCLASSIFIED.
    provenance: KNOWN_PROVENANCE.has(explicit)
      ? (explicit as Provenance)
      : classifyProvenance({
          id,
          board: "private",
          source: s(r.source),
          apply_url: s(r.apply_url),
          employer_id: s(r.employer_id),
          is_verified: Boolean(r.is_verified),
          job_status: s(r.job_status),
        }),
    // Ownership evidence carried through for downstream genuineness checks.
    employer_id: s(r.employer_id) || undefined,
    // No "#" placeholder: an absent destination stays absent.
    applyUrl: s(r.apply_url),
    desc: s(r.description),
    posted: s(r.posted_at),
    verified: Boolean(r.is_verified),
    source: s(r.source),
    board: "private",
  }

  const passthrough: Record<string, unknown> = {}
  for (const k of RAW_PASSTHROUGH) if (r[k] !== undefined) passthrough[k] = r[k]
  return { ...passthrough, ...mapped } as PrivateJobRecord
}
