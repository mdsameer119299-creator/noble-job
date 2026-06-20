import { JsonLd } from "@/components/seo/JsonLd"
import { jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import type { WfhJob } from "@/types/wfhJob"
import type { JobContent } from "@/lib/seo/jobContent"

export function WfhJobJsonLd({ job, content }: { job: WfhJob; content: JobContent }) {
  const url = `${siteUrl()}/jobs/wfh/${job.id}`
  const s = content.parsedSalary
  return (
    <JsonLd
      data={jobPostingSchema({
        title: job.title,
        description: content.schemaDescriptionHtml,
        url,
        datePosted: job.posted_at,
        validThrough: content.validThrough,
        employmentType: "FULL_TIME",
        organizationName: job.company,
        organizationUrl: job.apply_url,
        location: "India",
        addressCountry: "IN",
        remote: true,
        applicantCountry: "India",
        ...(s ? { salaryMin: s.minValue, salaryMax: s.maxValue, salaryCurrency: s.currency, salaryUnit: s.unitText } : {}),
        industry: job.cat || "Work From Home",
        qualifications: job.qualification || job.experience,
        educationRequirements: job.qualification,
        experienceRequirements: job.experience,
        identifier: job.id,
      })}
    />
  )
}
