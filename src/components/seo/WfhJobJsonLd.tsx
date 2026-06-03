import { JsonLd } from "@/components/seo/JsonLd"
import { jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import type { WfhJob } from "@/types/wfhJob"

export function WfhJobJsonLd({ job }: { job: WfhJob }) {
  const url = `${siteUrl()}/jobs/wfh/${job.id}`
  return (
    <JsonLd
      data={jobPostingSchema({
        title: job.title,
        description: job.description || `${job.title} at ${job.company} — remote work from home.`,
        url,
        datePosted: job.posted_at,
        employmentType: "FULL_TIME",
        organizationName: job.company,
        location: "Remote / India",
        addressCountry: "IN",
        salary: job.salary,
        industry: job.cat || "Work From Home",
        qualifications: job.qualification || job.experience,
        identifier: job.id,
      })}
    />
  )
}
