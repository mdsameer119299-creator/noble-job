import { JsonLd } from "@/components/seo/JsonLd"
import { faqPageSchema, jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import type { GovtJob } from "@/types/govtJob"

/** Schema.org JobPosting + optional FAQ for a government vacancy. */
export function GovtJobJsonLd({ job }: { job: GovtJob }) {
  const base = siteUrl()
  const url = `${base}/jobs/govt/${job.slug || job.id}`
  const posting = jobPostingSchema({
    title: job.title,
    description: job.overview || `${job.org} recruitment for ${job.post}. ${job.vacancies} vacancies.`,
    url,
    datePosted: job.postedAt || new Date().toISOString(),
    validThrough: job.lastDate !== "TBA" && job.lastDate !== "-" ? job.lastDate : undefined,
    organizationName: job.org,
    organizationUrl: job.officialUrl,
    location: job.location || job.state || "India",
    salary: job.salary,
    industry: "Government",
    qualifications: job.qualification,
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
