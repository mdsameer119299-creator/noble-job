/**
 * geoFilter.ts — India eligibility geo-filter
 *
 * Ported from isIndiaEligible logic in the original js-live-jobs script.
 * Determines if a Himalayas.app job is eligible for Indian candidates.
 * Runs server-side before caching API results.
 *
 * Rule: job is India-eligible if:
 *   - No location restrictions (worldwide/remote)
 *   - OR restrictions include India, Asia, Worldwide, Global
 *   - OR no restrictions at all (fully remote)
 */

const INDIA_ELIGIBLE_KEYWORDS = [
  "india", "worldwide", "global", "asia", "remote", "anywhere",
  "apac", "south asia", "international",
]

export function isIndiaEligible(locationRestrictions?: string[]): boolean {
  if (!locationRestrictions || locationRestrictions.length === 0) return true

  const combined = locationRestrictions.join(" ").toLowerCase()
  return INDIA_ELIGIBLE_KEYWORDS.some(kw => combined.includes(kw))
}
