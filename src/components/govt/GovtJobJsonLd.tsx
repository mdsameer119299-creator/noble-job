import { JsonLd } from "@/components/seo/JsonLd"
import { faqPageSchema, jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import { parseSalary } from "@/lib/seo/salary"
import type { GovtJob } from "@/types/govtJob"

/** Convert a display date like "30 Jun 2026" to ISO; undefined if unparseable. */
function toIso(date?: string): string | undefined {
  if (!date || date === "TBA" || date === "-") return undefined
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Schema.org JobPosting + optional FAQ for a government vacancy. */
export function GovtJobJsonLd({ job }: { job: GovtJob }) {
  const base = siteUrl()
  const url = `${base}/jobs/govt/${job.slug || job.id}`
  const s = parseSalary(job.salary)
  const posting = jobPostingSchema({
    title: job.title,
    description: job.overview || `${job.org} recruitment for ${job.post}. ${job.vacancies} vacancies.`,
    url,
    datePosted: job.postedAt || new Date().toISOString(),
    validThrough: toIso(job.lastDate),
    employmentType: "FULL_TIME",
    organizationName: job.org,
    organizationUrl: job.officialUrl,
    location: job.location || job.state || "India",
    addressRegion: job.state && job.state !== "All India" ? job.state : undefined,
    ...(s ? { salaryMin: s.minValue, salaryMax: s.maxValue, salaryCurrency: s.currency, salaryUnit: s.unitText } : {}),
    industry: "Government",
    qualifications: job.qualification,
    educationRequirements: job.qualification,
    identifier: job.id,
  })

  const schemas: Record<string, unknown>[] = [posting]
  if (job.faqs?.length) {
    schemas.push(
      faqPageSchema(job.faqs.map(f => ({ question: f.q, answer: f.a })))
    )
  }

  return <JsonLd data={schemas} />
}
