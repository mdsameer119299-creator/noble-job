/**
 * applyRoute.ts — the candidate-facing APPLICATION-STATE MODEL. One pure answer to
 * "where does Apply actually GO for this job, and what may the page say about it?",
 * shared by every apply control, the detail-page copy and JobPosting eligibility, so
 * the page, the API and the structured data can never disagree — and a candidate is
 * never told an employer received something that reached nobody.
 *
 * Route (where an application really goes):
 *   "employer" — NobleJob's own application flow AND the application is DELIVERED to
 *                the owning employer (EMPLOYER provenance with an employer_id → their
 *                dashboard / verified-employer email).
 *   "external" — the candidate is sent to the genuine source's own application page
 *                (a real, non-placeholder URL on an AGGREGATED / CURATED / OFFICIAL
 *                record). NobleJob does not receive or forward that application.
 *   "none"     — no employer delivery and no genuine external destination: a sample
 *                listing, an unclassified row, or a genuine-class row whose evidence
 *                is missing (e.g. an aggregated posting with no apply URL).
 *
 * State (what the page shows — `applyStateFor`):
 *   "employer" → Apply Now opens the on-site flow; copy says the application is sent
 *                to {company} through NobleJob.
 *   "external" → an Apply link to the source; copy says you are leaving NobleJob.
 *   "sample"   → a disabled control on a demo listing.
 *   "closed"   → a genuine job that is no longer open (closed / expired / past its
 *                real deadline): no Apply action.
 *   "listing"  → information only: NO Apply action, no "application sent/stored" copy.
 *
 * JobPosting requires a genuine route ("employer" or "external", narrowed per board by
 * `isJobPostingRoute`); "none" never qualifies. `directApply` is true ONLY for "employer" — the one route whose application is
 * completed on the page (see DIRECT_APPLY_FLOW) and reaches the employer. An external
 * redirect is never `directApply`.
 *
 * TALENT REGISTRATION is deliberately NOT an application route: a general profile /
 * resume registration is never presented as applying to a specific vacancy (see
 * TALENT_REGISTRATION). Nothing here ever creates an application record.
 *
 * Deliberately independent of whether the job is still open: openness is a separate
 * axis (`isOpen`), so a page can render the correct control for a closed job.
 */
import { classifyProvenance, hasRealApplyUrl, isGenericGovPortalUrl, isGenuine, isOpen, type Classifiable } from "./provenance"
import { govtClassifiable } from "./govtProvenance"
import type { GovtJob } from "@/types/govtJob"

export type ApplyRoute = "employer" | "external" | "none"
export type ApplyKind = "employer" | "external" | "sample" | "closed" | "listing"

type ApplyBoard = "private" | "wfh" | "abroad"

function applyUrlOf(rec: Classifiable): string {
  return (rec.applyUrl ?? rec.apply_url ?? "").toString().trim()
}

/**
 * The genuine external application destination of a record, or "" when it has none.
 * AGGREGATED / CURATED postings use their stored apply URL; an OFFICIAL posting may
 * fall back to its official / notification page. A placeholder ("#", example.*, empty,
 * non-http) is never a destination.
 */
export function externalApplyUrl(rec: Classifiable): string {
  const p = classifyProvenance(rec)
  if (p !== "AGGREGATED" && p !== "CURATED" && p !== "OFFICIAL") return ""
  const own = applyUrlOf(rec)
  if (hasRealApplyUrl(own) && !isGenericGovPortalUrl(own)) return own
  if (p !== "OFFICIAL") return ""
  for (const v of [rec.officialUrl, rec.official_url, rec.notificationUrl, rec.notification_url]) {
    const u = (v ?? "").toString().trim()
    if (hasRealApplyUrl(u) && !isGenericGovPortalUrl(u)) return u
  }
  return ""
}

/** Private / WFH / abroad record → the route its Apply control really takes. */
export function applyRouteFor(_board: ApplyBoard, rec: Classifiable): ApplyRoute {
  if (!isGenuine(rec)) return "none"
  const p = classifyProvenance(rec)
  if (p === "EMPLOYER") return "employer"
  return externalApplyUrl(rec) ? "external" : "none"
}

/** Government record → "external" only when it has a real, non-generic official destination. */
export function govtApplyRoute(job: GovtJob): ApplyRoute {
  if (!isGenuine(govtClassifiable(job))) return "none"
  const real = [job.applyUrl, job.officialUrl].some(u => hasRealApplyUrl(u) && !isGenericGovPortalUrl(u))
  return real ? "external" : "none"
}

/** Is this a route a candidate can really apply through? ("none" is never one.) */
export function isGenuineApplyRoute(route: ApplyRoute): boolean {
  return route === "employer" || route === "external"
}

/**
 * Does this record qualify for JobPosting on this board? (JobPosting output is
 * deliberately NOT widened by the apply-state model.)
 *   • any board — an employer-delivered NobleJob application ("employer" route).
 *   • abroad only — an AGGREGATED posting with a real external application URL
 *     (`directApply` false).
 * A curated / aggregated posting on the private or WFH board, or a curated abroad one,
 * gets an honest external Apply link but no structured data — NobleJob is not the source
 * of those vacancies. Government rows use `isGenuineApplyRoute(govtApplyRoute(job))`.
 */
export function isJobPostingRoute(board: ApplyBoard, rec: Classifiable, route: ApplyRoute = applyRouteFor(board, rec)): boolean {
  if (route === "employer") return true
  return route === "external" && board === "abroad" && classifyProvenance(rec) === "AGGREGATED"
}

/* ------------------------------------------------------------------ */
/* directApply                                                          */
/* ------------------------------------------------------------------ */

/**
 * What the NobleJob employer flow does — every property is asserted against the
 * implementation by the apply-state tests. JobPosting `directApply` may be true ONLY
 * for the "employer" route AND only while every one of these holds (Google: the
 * application is completed on the page, no unnecessary intermediate steps, one
 * sign-in at most, job details viewable without login, and the application reaches
 * the employer).
 */
export const DIRECT_APPLY_FLOW = {
  /** Apply opens a modal on the job page — no redirect to another site. */
  completedOnPage: true,
  offSiteRedirect: false,
  /** The visitor may read the whole job without an account. */
  jobViewableWithoutLogin: true,
  /** A guest signs in once and is returned to the same job. */
  maxSignInsBeforeSubmit: 1,
  /** The submission reaches the employer (dashboard; email for a verified employer). */
  deliveredToEmployer: true,
} as const

/** `directApply` for a JobPosting: the employer route, and only while the flow above holds. */
export function isDirectApply(route: ApplyRoute): boolean {
  return (
    route === "employer" &&
    DIRECT_APPLY_FLOW.completedOnPage &&
    !DIRECT_APPLY_FLOW.offSiteRedirect &&
    DIRECT_APPLY_FLOW.deliveredToEmployer &&
    DIRECT_APPLY_FLOW.jobViewableWithoutLogin &&
    DIRECT_APPLY_FLOW.maxSignInsBeforeSubmit <= 1
  )
}

/* ------------------------------------------------------------------ */
/* Talent registration — never an application                          */
/* ------------------------------------------------------------------ */

/**
 * A general profile / resume registration. It is offered SEPARATELY from any job's
 * Apply control, carries no job id, and is never worded as applying to a vacancy.
 */
export const TALENT_REGISTRATION = {
  label: "Save your profile on Noble Job",
  href: "/candidate/profile",
  /** The whole disclaimer — no company or vacancy is named, none is applied to. */
  note: "This is a general profile registration, not a job application. It is not sent to any employer for this or any other specific vacancy.",
} as const

/* ------------------------------------------------------------------ */
/* Application state                                                    */
/* ------------------------------------------------------------------ */

export interface ApplyState {
  kind: ApplyKind
  route: ApplyRoute
  /** The external destination — set ONLY for kind "external". */
  href?: string
  /** Button / link label. `null` = there is NO apply action. */
  cta: string | null
  /** Honest one-line explanation shown beside the control. */
  note: string
  /** JobPosting `directApply`. */
  directApply: boolean
}

export const SAMPLE_APPLY_NOTE =
  "This is a sample listing shown for reference. The role and company are illustrative, not a confirmed vacancy, and no application can be submitted."

export const CLOSED_APPLY_NOTE = "This job is closed and is no longer accepting applications."

export const LISTING_ONLY_NOTE =
  "Information only. This listing has no application link and Noble Job does not send applications to an employer for it, so there is nothing to apply to here."

/** The full apply state of a private / WFH / abroad record. */
export function applyStateFor(board: ApplyBoard, rec: Classifiable, company?: string): ApplyState {
  const p = classifyProvenance(rec)
  if (p === "SYNTHETIC") {
    return { kind: "sample", route: "none", cta: null, note: SAMPLE_APPLY_NOTE, directApply: false }
  }
  const route = applyRouteFor(board, rec)
  if (route !== "none" && !isOpen(rec)) {
    return { kind: "closed", route, cta: null, note: CLOSED_APPLY_NOTE, directApply: false }
  }
  if (route === "employer") {
    const to = (company ?? "").trim()
    return {
      kind: "employer",
      route,
      cta: "Apply Now →",
      note: to
        ? `Your application is sent to ${to} through Noble Job.`
        : "Your application is sent to the employer through Noble Job.",
      directApply: isDirectApply(route),
    }
  }
  if (route === "external") {
    return {
      kind: "external",
      route,
      href: externalApplyUrl(rec),
      cta: p === "OFFICIAL" ? "Apply on the official site →" : "Apply on the original listing →",
      note: "You will leave Noble Job to apply on the original listing. Noble Job does not receive or forward applications made there.",
      directApply: false,
    }
  }
  return { kind: "listing", route: "none", cta: null, note: LISTING_ONLY_NOTE, directApply: false }
}
