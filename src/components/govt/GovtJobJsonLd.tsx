import { JsonLd } from "@/components/seo/JsonLd"
import { faqPageSchema, jobPostingSchema } from "@/lib/seo/schema"
import { siteUrl } from "@/lib/seo/constants"
import { parseSalary } from "@/lib/seo/salary"
import { INDIAN_STATES } from "@/lib/config/govtTaxonomy"
import type { GovtJob } from "@/types/govtJob"

/** Known Indian state/UT names (lowercased) — a state is never a city locality. */
const STATE_NAMES = new Set(INDIAN_STATES.map(s => s.label.toLowerCase()))

/** Convert a display date like "30 Jun 2026" to ISO; undefined if unparseable. */
function toIso(date?: string): string | undefined {
  if (!date || date === "TBA" || date === "-") return undefined
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/**
 * National / non-geographic placeholders that are not a real addressRegion.
 * When the state resolves to one of these we omit addressRegion rather than
 * emit a value Google would treat as an invalid region.
 */
const NON_REGION = new Set([
  "all india", "pan india", "central", "central government", "anywhere",
  "anywhere in india", "india", "multiple", "various", "all states", "-", "tba",
])

/** Return a clean addressRegion when the state is a real, known region. */
function regionFor(state?: string): string | undefined {
  const t = state?.trim()
  if (!t) return undefined
  return NON_REGION.has(t.toLowerCase()) ? undefined : t
}

/**
 * Return a clean addressLocality only when the location clearly identifies a
 * single city — never a state, a national placeholder, or a multi-location list.
 * "New Delhi, Delhi" → "New Delhi"; "Maharashtra"/"All India"/"Multiple" → omit.
 */
function localityFor(location?: string, state?: string): string | undefined {
  const first = location?.split(",")[0]?.trim() // take the city part of "City, State"
  if (!first) return undefined
  const low = first.toLowerCase()
  if (NON_REGION.has(low)) return undefined // national placeholder
  if (/[/&]|\bmultiple\b|\bvarious\b|\bacross\b/.test(low)) return undefined // list / non-city
  if (state && low === state.trim().toLowerCase()) return undefined // it's the state, not a city
  if (STATE_NAMES.has(low)) return undefined // a state name is not a locality
  return first
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
    // Populate addressLocality only when the location names a real city, and
    // addressRegion whenever the state is a real region; always IN.
    // streetAddress/postalCode are intentionally never set — govt vacancies
    // carry no such source data, so emitting them would fabricate values.
    addressLocality: localityFor(job.location, job.state),
    addressRegion: regionFor(job.state),
    addressCountry: "IN",
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
