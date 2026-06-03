import type { GovtJob } from "@/types/govtJob"
import { getQualificationBySlug } from "@/lib/config/govtTaxonomy"

/** True when job eligibility text or tags match a qualification bucket. */
export function jobMatchesQualification(job: GovtJob, slug: string): boolean {
  const qual = getQualificationBySlug(slug)
  if (!qual) return false
  if (job.qualificationTags?.includes(slug)) return true
  const hay = `${job.qualification || ""} ${job.eligibility || ""} ${job.overview || ""}`.toLowerCase()
  return qual.keywords.some(k => hay.includes(k.toLowerCase()))
}
