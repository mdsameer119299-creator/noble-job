import { JsonLd } from "@/components/seo/JsonLd"
import { jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import { isSchemaEligible } from "@/lib/jobs/provenance"
import type { Job } from "@/types/job"
import type { JobContent } from "@/lib/seo/jobContent"

export function PrivateJobJsonLd({ job, content }: { job: Job; content: JobContent }) {
  // Synthetic/demo or non-open rows never carry JobPosting schema.
  if (!isSchemaEligible(job)) return null
  const base = siteUrl()
  const url = `${base}/jobs/private/${job.id}`
  const row = job as Job & { posted_at?: string; job_type?: string; experience_required?: string }
  const datePosted = row.posted_at || job.posted
  if (!datePosted) return null
  const s = content.parsedSalary

  return (
    <JsonLd
      data={jobPostingSchema({
        title: job.title,
        description: content.schemaDescriptionHtml,
        url,
        datePosted,
        validThrough: content.validThrough,
        employmentType: (row.job_type || job.type || "FULL_TIME").replace(/\s+/g, "_").toUpperCase(),
        organizationName: job.company,
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
