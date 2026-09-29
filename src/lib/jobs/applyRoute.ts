/**
 * Candidate-facing application-state model.
 *
 * Noble Job policy:
 * - Private / WFH / Abroad: applications are completed inside Noble Job and held
 *   for admin review before any employer can see the candidate or resume.
 * - Government: the candidate is sent to the official government application site.
 * - Sourced external vacancies are informational until their employer joins/posts
 *   the vacancy on Noble Job; they never receive an external candidate application.
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

export function externalApplyUrl(rec: Classifiable): string {
  const p = classifyProvenance(rec)
  if (p !== "OFFICIAL") return ""
  const own = applyUrlOf(rec)
  if (hasRealApplyUrl(own) && !isGenericGovPortalUrl(own)) return own
  for (const v of [rec.officialUrl, rec.official_url, rec.notificationUrl, rec.notification_url]) {
    const u = (v ?? "").toString().trim()
    if (hasRealApplyUrl(u) && !isGenericGovPortalUrl(u)) return u
  }
  return ""
}

/** Private / WFH / Abroad: only an actual Noble Job employer posting can accept applications. */
export function applyRouteFor(_board: ApplyBoard, rec: Classifiable): ApplyRoute {
  if (!isGenuine(rec)) return "none"
  return classifyProvenance(rec) === "EMPLOYER" ? "employer" : "none"
}

/** Government jobs are the only candidate flow that leaves Noble Job to apply. */
export function govtApplyRoute(job: GovtJob): ApplyRoute {
  if (!isGenuine(govtClassifiable(job))) return "none"
  const real = [job.applyUrl, job.officialUrl].some(u => hasRealApplyUrl(u) && !isGenericGovPortalUrl(u))
  return real ? "external" : "none"
}

export function isGenuineApplyRoute(route: ApplyRoute): boolean {
  return route === "employer" || route === "external"
}

export const DIRECT_APPLY_FLOW = {
  completedOnPage: true,
  offSiteRedirect: false,
  jobViewableWithoutLogin: true,
  maxSignInsBeforeSubmit: 1,
  deliveredToEmployer: true,
} as const

export function isDirectApply(route: ApplyRoute): boolean {
  return (
    route === "employer" &&
    DIRECT_APPLY_FLOW.completedOnPage &&
    !DIRECT_APPLY_FLOW.offSiteRedirect &&
    DIRECT_APPLY_FLOW.jobViewableWithoutLogin &&
    DIRECT_APPLY_FLOW.maxSignInsBeforeSubmit <= 1
  )
}

export const TALENT_REGISTRATION = {
  label: "Save your profile on Noble Job",
  href: "/candidate/profile",
  note: "This is a general profile registration. It is not sent to any employer for a specific vacancy unless you apply and Noble Job approves the application.",
} as const

export interface ApplyState {
  kind: ApplyKind
  route: ApplyRoute
  href?: string
  cta: string | null
  note: string
  directApply: boolean
}

export const SAMPLE_APPLY_NOTE =
  "This is a sample listing shown for reference. The role and company are illustrative, not a confirmed vacancy, and no application can be submitted."
export const CLOSED_APPLY_NOTE = "This job is closed and is no longer accepting applications."
export const LISTING_ONLY_NOTE =
  "This opportunity is informational until the employer posts it on Noble Job. Candidate applications and resumes are never sent to an external website."

export function applyStateFor(board: ApplyBoard, rec: Classifiable, company?: string): ApplyState {
  const p = classifyProvenance(rec)
  if (p === "SYNTHETIC") return { kind: "sample", route: "none", cta: null, note: SAMPLE_APPLY_NOTE, directApply: false }
  const route = applyRouteFor(board, rec)
  if (route !== "none" && !isOpen(rec)) return { kind: "closed", route, cta: null, note: CLOSED_APPLY_NOTE, directApply: false }
  if (route === "employer") {
    const to = (company ?? "").trim()
    return {
      kind: "employer",
      route,
      cta: "Apply Now →",
      note: to
        ? `Apply on Noble Job. Your application and resume are reviewed by Noble Job before being shared with ${to}.`
        : "Apply on Noble Job. Your application and resume are reviewed by Noble Job before being shared with the employer.",
      directApply: isDirectApply(route),
    }
  }
  return { kind: "listing", route: "none", cta: null, note: LISTING_ONLY_NOTE, directApply: false }
}
