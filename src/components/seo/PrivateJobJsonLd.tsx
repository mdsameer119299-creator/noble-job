import { JsonLd } from "@/components/seo/JsonLd"
import { jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import type { Job } from "@/types/job"
import type { JobContent } from "@/lib/seo/jobContent"

export function PrivateJobJsonLd({ job, content }: { job: Job; content: JobContent }) {
  const base = siteUrl()
  const url = `${base}/jobs/private/${job.id}`
  const row = job as Job & { posted_at?: string; job_type?: string; experience_required?: string }
  const s = content.parsedSalary

  return (
    <JsonLd
      data={jobPostingSchema({
        title: job.title,
        description: content.schemaDescriptionHtml,
        url,
        datePosted: row.posted_at || job.posted || new Date().toISOString(),
        validThrough: content.validThrough,
        employmentType: (row.job_type || job.type || "FULL_TIME").replace(/\s+/g, "_").toUpperCase(),
        organizationName: job.company,
        organizationUrl: row.apply_url || job.applyUrl,
        location: job.location || "India",
        addressLocality: job.location,
        addressCountry: "IN",
        ...(s ? { salaryMin: s.minValue, salaryMax: s.maxValue, salaryCurrency: s.currency, salaryUnit: s.unitText } : {}),
        industry: job.cat || "Private Sector",
        qualifications: row.experience_required || job.exp,
        experienceRequirements: row.experience_required || job.exp,
        identifier: job.id,
      })}
    />
  )
}
