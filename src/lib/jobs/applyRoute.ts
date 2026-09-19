/**
 * applyRoute.ts — where does "Apply" actually GO for a job? One pure answer shared
 * by the apply controls and by JobPosting eligibility, so structured data can never
 * promise an application the page does not deliver.
 *
 *   "employer"   — NobleJob's own application flow, and the application is DELIVERED
 *                  to the owning employer (EMPLOYER provenance with an employer_id).
 *   "external"   — the candidate is sent to the employer's / official source's own
 *                  application page (a real, non-placeholder URL).
 *   "unverified" — anything else: a sample listing (disabled), an unclassified row, or
 *                  a NobleJob apply form whose submission is stored ownerless and is not
 *                  forwarded to the employer/source (aggregated / curated postings on the
 *                  private and WFH boards, curated abroad postings).
 *
 * JobPosting requires a genuine application route: only "employer" and "external"
 * qualify. `directApply` is true ONLY for "employer" (the application is completed on
 * the page and reaches the employer) — an external redirect is `directApply: false`.
 *
 * Deliberately independent of whether the job is still open: openness is a separate
 * axis (`isOpen`), so a page can render the correct control for a closed job.
 */
import { classifyProvenance, hasRealApplyUrl, isGenericGovPortalUrl, isGenuine, type Classifiable } from "./provenance"
import { govtClassifiable } from "./govtProvenance"
import type { GovtJob } from "@/types/govtJob"

export type ApplyRoute = "employer" | "external" | "unverified"

type ApplyBoard = "private" | "wfh" | "abroad"

function applyUrlOf(rec: Classifiable): string {
  return (rec.applyUrl ?? rec.apply_url ?? "").toString().trim()
}

/** Private / WFH / abroad record → the route its Apply control really takes. */
export function applyRouteFor(board: ApplyBoard, rec: Classifiable): ApplyRoute {
  if (!isGenuine(rec)) return "unverified"
  const p = classifyProvenance(rec)
  if (p === "EMPLOYER") return "employer"
  // The abroad apply control sends AGGREGATED (third-party feed) jobs to the
  // employer's own career page. No other genuine class leaves NobleJob.
  if (board === "abroad" && p === "AGGREGATED" && hasRealApplyUrl(applyUrlOf(rec))) return "external"
  return "unverified"
}

/** Government record → "external" only when it has a real, non-generic official destination. */
export function govtApplyRoute(job: GovtJob): ApplyRoute {
  if (!isGenuine(govtClassifiable(job))) return "unverified"
  const real = [job.applyUrl, job.officialUrl].some(u => hasRealApplyUrl(u) && !isGenericGovPortalUrl(u))
  return real ? "external" : "unverified"
}

/** Does this route qualify a job for JobPosting? */
export function isGenuineApplyRoute(route: ApplyRoute): boolean {
  return route === "employer" || route === "external"
}
