import { JsonLd } from "@/components/seo/JsonLd"
import { jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import type { AbroadJob } from "@/types/abroadJob"
import type { JobContent } from "@/lib/seo/jobContent"

const COUNTRY_ISO: Record<string, string> = {
  uae: "AE", "united arab emirates": "AE", "saudi arabia": "SA", ksa: "SA",
  qatar: "QA", kuwait: "KW", oman: "OM", bahrain: "BH",
  uk: "GB", "united kingdom": "GB", usa: "US", "united states": "US",
  canada: "CA", australia: "AU", germany: "DE", singapore: "SG", "new zealand": "NZ",
}

function isoFor(country?: string): string | undefined {
  if (!country) return undefined
  return COUNTRY_ISO[country.trim().toLowerCase()] || (country.length === 2 ? country.toUpperCase() : country)
}

export function AbroadJobJsonLd({ job, content }: { job: AbroadJob; content: JobContent }) {
  const url = `${siteUrl()}/jobs/abroad/${job.id}`
  const s = content.parsedSalary
  return (
    <JsonLd
      data={jobPostingSchema({
        title: job.title,
        description: content.schemaDescriptionHtml,
        url,
        datePosted: job.posted_at,
        validThrough: content.validThrough,
        employmentType: (job.type || "FULL_TIME").replace(/\s+/g, "_").toUpperCase(),
        organizationName: job.company,
        organizationUrl: job.apply_url,
        location: job.location || job.country,
        addressLocality: job.location || job.country,
        addressRegion: job.country,
        addressCountry: isoFor(job.country),
        ...(s ? { salaryMin: s.minValue, salaryMax: s.maxValue, salaryCurrency: s.currency, salaryUnit: s.unitText } : {}),
        industry: job.category || "International",
        qualifications: job.experience,
        experienceRequirements: job.experience,
        identifier: job.id,
      })}
    />
  )
}
