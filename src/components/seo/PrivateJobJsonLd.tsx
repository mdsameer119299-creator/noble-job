import { JsonLd } from "@/components/seo/JsonLd"
import { jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import type { Job } from "@/types/job"

export function PrivateJobJsonLd({ job }: { job: Job }) {
  const base = siteUrl()
  const url = `${base}/jobs/private/${job.id}`
  const row = job as Job & {
    description?: string
    posted_at?: string
    job_type?: string
    experience_required?: string
  }

  const schema = jobPostingSchema({
    title: job.title,
    description: row.description || job.desc || `${job.title} at ${job.company}`,
    url,
    datePosted: row.posted_at || job.posted || new Date().toISOString(),
    employmentType: (row.job_type || job.type || "FULL_TIME").replace(/\s+/g, "_").toUpperCase(),
    organizationName: job.company,
    location: job.location || "India",
    salary: job.salary,
    industry: job.cat || "Private Sector",
    qualifications: row.experience_required || job.exp,
    identifier: job.id,
  })

  return <JsonLd data={schema} />
}
