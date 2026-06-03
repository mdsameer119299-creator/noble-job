import { JsonLd } from "@/components/seo/JsonLd"
import { jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import type { AbroadJob } from "@/types/abroadJob"

export function AbroadJobJsonLd({ job }: { job: AbroadJob }) {
  const url = `${siteUrl()}/jobs/abroad/${job.id}`
  return (
    <JsonLd
      data={jobPostingSchema({
        title: job.title,
        description: job.description || `${job.title} at ${job.company} in ${job.country}.`,
        url,
        datePosted: job.posted_at,
        employmentType: "FULL_TIME",
        organizationName: job.company,
        location: job.location || job.country,
        addressCountry: job.country?.length === 2 ? job.country : undefined,
        salary: job.salary,
        industry: job.category || "International",
        qualifications: job.experience,
        identifier: job.id,
      })}
    />
  )
}
