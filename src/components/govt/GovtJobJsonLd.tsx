import { JsonLd } from "@/components/seo/JsonLd"
import { faqPageSchema } from "@/lib/seo/schema"
import { buildGovtJobPosting } from "@/lib/seo/jobPostingBuilders"
import { INDIAN_STATES } from "@/lib/config/govtTaxonomy"
import { govtClassifiable, isSchemaEligible } from "@/lib/jobs/govtProvenance"
import type { GovtJob } from "@/types/govtJob"

/** Known Indian state/UT names (lowercased) — a state is never a city locality. */
const STATE_NAMES = new Set(INDIAN_STATES.map(s => s.label.toLowerCase()))

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

/** Schema.org JobPosting (recruitment notifications only) + optional FAQ for a government record. */
export function GovtJobJsonLd({ job }: { job: GovtJob }) {
  // Fail closed: nothing at all unless this is a genuine OFFICIAL row (real
  // official or notification URL), never merely because it is on the govt board.
  if (!isSchemaEligible(govtClassifiable(job))) return null

  // JobPosting only for a recruitment NOTIFICATION with a real source
  // publication date — never for results, answer keys, admit cards, cut-offs,
  // syllabi or previous papers (see buildGovtJobPosting).
  const posting = buildGovtJobPosting(job, { regionFor, localityFor })

  const schemas: Record<string, unknown>[] = posting ? [posting] : []
  if (job.faqs?.length) {
    schemas.push(
      faqPageSchema(job.faqs.map(f => ({ question: f.q, answer: f.a })))
    )
  }
  if (!schemas.length) return null

  return <JsonLd data={schemas} />
}
