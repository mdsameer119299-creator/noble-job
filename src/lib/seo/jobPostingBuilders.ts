/**
 * jobPostingBuilders.ts — the ONLY place each board's record is turned into a
 * JobPosting input. Pure functions (no React) so every rule is unit-testable.
 *
 * Every builder returns `null` — i.e. NO JobPosting — unless the record passes
 * the provenance gate AND carries the real data JobPosting requires. See
 * `jobPostingSchema` for the field-level rules (no invented dates, no default
 * directApply, no NobleJob logo, sameAs never the apply URL, ISO countries).
 */
import { jobPostingSchema } from "./schema"
import { siteUrl } from "./constants"
import {
  cleanHttpUrl,
  endOfDayIst,
  isGenuinelyFullyRemote,
  originOf,
  parseRealDate,
  resolveApplicantCountry,
  resolveCountryIso,
} from "./jobPostingRules"
import { buildGovtFactsDescription, buildStoredDescription } from "./jobPostingDescription"
import { originalPostingDate } from "./postingDate"
import { isRenderableJob } from "../jobs/renderable"
import { isSchemaEligible } from "../jobs/provenance"
import { applyRouteFor, govtApplyRoute, isGenuineApplyRoute } from "../jobs/applyRoute"
import { govtClassifiable, isSchemaEligible as isGovtSchemaEligible } from "../jobs/govtProvenance"
import { canEmitJobPosting, govtRecordTypeOf } from "../govt/recordType"
import { parseSalary } from "./salary"
import type { Job } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"
import type { GovtJob } from "@/types/govtJob"
import type { JobContent } from "./jobContent"

type SalaryFields = Partial<{
  salaryMin: number
  salaryMax: number
  salaryCurrency: string
  salaryUnit: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR"
}>

/**
 * The JobPosting `description` is the record's STORED description plus its stored
 * facts (see jobPostingDescription.ts) — never the page's generated copy. A record
 * without a substantive stored description yields no JobPosting.
 */

/**
 * baseSalary from the STORED salary text, and only when that text states BOTH the
 * currency and the pay period. The lenient page-copy parser (`content.parsedSalary`)
 * defaults an unstated currency to INR and an unstated period to "per year"; those
 * guesses must never reach structured data, so the schema re-parses in explicit mode.
 */
function salaryFields(salaryText: unknown): SalaryFields {
  const s = parseSalary(typeof salaryText === "string" ? salaryText : undefined, { requireExplicit: true })
  return s ? { salaryMin: s.minValue, salaryMax: s.maxValue, salaryCurrency: s.currency, salaryUnit: s.unitText } : {}
}

/* ------------------------------------------------------------------ */
/* Private                                                             */
/* ------------------------------------------------------------------ */

export function buildPrivateJobPosting(job: Job, content: JobContent) {
  // Synthetic/demo, unclassified, closed or non-open rows never carry JobPosting;
  // neither does a record too incomplete to be shown as a job at all.
  if (!isSchemaEligible(job) || !isRenderableJob(job, "private")) return null
  // A JobPosting promises the candidate can apply. Only an employer-delivered NobleJob
  // application (or an external redirect to the employer/source) is a real route; the
  // private-board Apply control stores aggregated / curated applications ownerless.
  const route = applyRouteFor("private", job)
  if (!isGenuineApplyRoute(route)) return null
  const row = job as Job & {
    source_posted_at?: string | null
    description?: string
    job_type?: string
    experience_required?: string
    application_deadline?: string | null
  }
  const description = buildStoredDescription({
    description: row.description || job.desc,
    facts: [
      { label: "Employer", value: job.company },
      { label: "Location", value: job.location },
      { label: "Employment type", value: row.job_type || job.type },
      { label: "Experience", value: row.experience_required || job.exp },
      { label: "Skills", value: job.skills },
      { label: "Salary", value: job.salary },
    ],
  })
  if (!description) return null
  return jobPostingSchema({
    title: job.title,
    description,
    url: `${siteUrl()}/jobs/private/${job.id}`,
    // ONLY the genuine ORIGINAL publication date (`source_posted_at`). `posted_at`
    // is NobleJob's row-creation / ingestion time and `job.posted` is a display
    // string — neither may become `datePosted`. No source date → no JobPosting.
    datePosted: originalPostingDate(row, "private"),
    validThrough: content.validThrough, // employer's real deadline only
    employmentType: row.job_type || job.type,
    organizationName: job.company,
    applyUrl: row.apply_url || job.applyUrl,
    // The employer's own logo only — `job.logo` may be initials, not a URL.
    organizationLogo: cleanHttpUrl(job.logoUrl) || cleanHttpUrl(job.logo),
    location: job.location,
    addressLocality: job.location,
    // The private board is India-only ("Private Jobs India" — the page title, and the
    // location is an Indian city/state), so the country is the board's, not a guess.
    addressCountry: "IN",
    ...salaryFields(job.salary),
    // Category is shown on the page; no invented industry when the record has none.
    industry: job.cat || undefined,
    // `qualifications` is education/credentials — the record stores experience only.
    experienceRequirements: row.experience_required || job.exp,
    identifier: job.id,
    directApply: route === "employer",
  })
}

/* ------------------------------------------------------------------ */
/* Work from home                                                      */
/* ------------------------------------------------------------------ */

export function buildWfhJobPosting(job: WfhJob, content: JobContent) {
  if (!isSchemaEligible(job) || !isRenderableJob(job, "wfh")) return null
  // Only a genuine application route (see private board above; same WFH Apply control).
  const route = applyRouteFor("wfh", job)
  if (!isGenuineApplyRoute(route)) return null
  // TELECOMMUTE only when the STORED record establishes the role is fully (100%)
  // remote: positive evidence in its type / description, and no hybrid, on-site or
  // office-day wording anywhere. Being on the WFH board is not evidence; a hybrid or
  // uncertain record is not TELECOMMUTE and therefore has no JobPosting.
  if (!isGenuinelyFullyRemote({ type: job.type, title: job.title, description: job.description })) return null
  // Google requires the country candidates may apply from. It must be STORED
  // (`applicant_country`) or stated explicitly in the record's own text — never
  // assumed. No country → no JobPosting. No physical jobLocation is emitted for a
  // remote role (there is no `addressCountry`).
  const applicantCountry = resolveApplicantCountry(job.applicant_country, job.type, job.title, job.description)
  if (!applicantCountry) return null
  const description = buildStoredDescription({
    description: job.description,
    facts: [
      { label: "Employer", value: job.company },
      { label: "Work arrangement", value: "Fully remote" },
      { label: "Employment type", value: job.type },
      { label: "Experience", value: job.experience },
      { label: "Qualification", value: job.qualification },
      { label: "Skills", value: job.skills },
      { label: "Salary", value: job.salary },
    ],
  })
  if (!description) return null
  return jobPostingSchema({
    title: job.title,
    description,
    url: `${siteUrl()}/jobs/wfh/${job.id}`,
    datePosted: originalPostingDate(job, "wfh"), // source_posted_at only — never posted_at
    validThrough: content.validThrough,
    employmentType: job.type, // "Full-Time Remote" → FULL_TIME; unknown → omitted
    organizationName: job.company,
    applyUrl: job.apply_url,
    organizationLogo: cleanHttpUrl(job.logo),
    location: "Remote",
    remote: true,
    applicantCountry,
    ...salaryFields(job.salary),
    industry: job.cat || undefined,
    qualifications: job.qualification || undefined,
    educationRequirements: job.qualification,
    experienceRequirements: job.experience,
    identifier: job.id,
    directApply: route === "employer",
  })
}

/* ------------------------------------------------------------------ */
/* Abroad                                                              */
/* ------------------------------------------------------------------ */

export function buildAbroadJobPosting(job: AbroadJob, content: JobContent) {
  if (!isSchemaEligible(job) || !isRenderableJob(job, "abroad")) return null
  // Employer-delivered application, or the external employer career page the abroad
  // Apply control really opens (AGGREGATED). Curated abroad postings apply ownerless.
  const route = applyRouteFor("abroad", job)
  if (!isGenuineApplyRoute(route)) return null
  const iso = resolveCountryIso(job.country)
  // The location is a city only when it is not just the country repeated.
  const loc = (job.location ?? "").trim()
  const locIsCountry = !loc || resolveCountryIso(loc) !== undefined || loc.toLowerCase() === (job.country ?? "").trim().toLowerCase()
  const description = buildStoredDescription({
    description: job.description,
    facts: [
      { label: "Employer", value: job.company },
      { label: "Country", value: job.country },
      { label: "Location", value: locIsCountry ? undefined : loc },
      { label: "Employment type", value: job.type },
      { label: "Experience", value: job.experience },
      { label: "Skills", value: job.skills },
      { label: "Salary", value: job.salary },
    ],
  })
  if (!description) return null
  return jobPostingSchema({
    title: job.title,
    description,
    url: `${siteUrl()}/jobs/abroad/${job.id}`,
    datePosted: originalPostingDate(job, "abroad"), // source_posted_at only — never posted_at
    validThrough: content.validThrough,
    employmentType: job.type,
    organizationName: job.company,
    applyUrl: job.apply_url,
    organizationLogo: cleanHttpUrl(job.logo),
    location: job.location || job.country,
    ...(locIsCountry ? {} : { addressLocality: loc }),
    addressCountry: iso, // unresolvable country → no JobPosting
    ...salaryFields(job.salary),
    industry: job.category || undefined,
    experienceRequirements: job.experience,
    identifier: job.id,
    directApply: route === "employer",
  })
}

/* ------------------------------------------------------------------ */
/* Government                                                          */
/* ------------------------------------------------------------------ */

/** Known Indian state names are supplied by the caller (avoids a config import cycle in tests). */
export interface GovtLocationHelpers {
  regionFor(state?: string): string | undefined
  localityFor(location?: string, state?: string): string | undefined
}

/**
 * Government JobPosting. Emitted only for a genuine OFFICIAL row whose record
 * type is a recruitment NOTIFICATION and that has a REAL source publication date
 * (`sourcePublishedAt`). Results, answer keys, admit cards, cut-offs, syllabi and
 * previous papers never emit JobPosting; neither does a notification whose
 * publication date is unknown (we do not stamp "now").
 */
export function buildGovtJobPosting(job: GovtJob, helpers: GovtLocationHelpers) {
  if (!isGovtSchemaEligible(govtClassifiable(job))) return null
  if (!isRenderableJob(job as never, "govt")) return null
  if (!canEmitJobPosting(govtRecordTypeOf(job))) return null
  // The candidate must be sent to a real, recruiting-body destination (never the generic
  // catch-all portal the link resolver falls back to).
  if (!isGenuineApplyRoute(govtApplyRoute(job))) return null
  // The official source's real publication date only (never fetch / created / updated time).
  const datePosted = originalPostingDate(job, "govt")
  if (!datePosted) return null

  // Stored fields only. `job.overview` (and eligibility / selection / FAQ copy) is
  // generated from templates at enrichment, and `job.vacancies` may be a synthesized
  // display count — neither is presented to Google as source information.
  const description = buildGovtFactsDescription({
    title: job.title,
    org: job.org,
    post: job.post,
    vacanciesStated: job.vacanciesStated,
    qualification: job.qualification,
    salary: job.salary,
    lastDate: job.lastDate,
    ageRange: job.ageRange,
    fee: job.fee,
    startDate: job.startDate,
    examDate: job.examDate,
    location: job.location,
    state: job.state,
  })
  if (!description) return null

  return jobPostingSchema({
    title: job.title,
    description,
    url: `${siteUrl()}/jobs/govt/${job.slug || job.id}`,
    datePosted,
    // Real closing date only (TBA / "-" → omitted). Open through the last day (IST).
    validThrough: endOfDayIst(parseRealDate(job.lastDate)),
    // Employment type is not stored for government rows → omitted, not FULL_TIME.
    organizationName: job.org,
    // The recruiting body's / source website — the origin, never a deep or apply link.
    organizationSameAs: originOf(job.officialUrl),
    applyUrl: job.applyUrl,
    location: job.location || job.state || "India",
    addressLocality: helpers.localityFor(job.location, job.state),
    addressRegion: helpers.regionFor(job.state),
    addressCountry: "IN",
    ...salaryFields(job.salary),
    // "Government" is the board itself, stated on the page (H1/breadcrumb/org).
    industry: "Government",
    // The qualification is an education requirement (parsed below), not free-form
    // "qualifications" — emit it once, in the field Google reads for it.
    educationRequirements: job.qualification,
    // No `identifier`: the government page does not display a notification/job id, and
    // a structured-data field must be visible on the page.
    // Applications are made on the official portal, not delivered via NobleJob.
    directApply: false,
  })
}
