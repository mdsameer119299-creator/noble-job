/**
 * jobLinks.ts — shared internal-linking helpers for job detail pages.
 * Keeps deep pages linked to category, city and homepage hubs so Google can
 * crawl the whole graph and pass authority inward.
 */
import type { InternalLink } from "@/components/jobs/JobDetailTemplate"

export const CITY_HUBS = [
  "Delhi", "Noida", "Gurgaon", "Mumbai", "Bangalore", "Bengaluru", "Hyderabad",
  "Chennai", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Chandigarh", "Lucknow",
  "Indore", "Kochi", "Coimbatore", "Nagpur",
] as const

/** Cities that have a dedicated /jobs-in-<city> landing hub (Phase 2). */
const CITY_LANDING_SLUGS = new Set([
  "delhi", "gurgaon", "noida", "mumbai", "bangalore", "hyderabad", "pune", "chennai",
])

/**
 * Detect a known Indian city from a free-text location and return an internal
 * link. Prefers the rich /jobs-in-<city> landing hub when one exists (so every
 * city job page feeds link equity to its hub); otherwise falls back to the
 * board listing filtered by city. Returns undefined for remote / overseas /
 * unknown locations so we never link to an empty page.
 */
export function detectCityLink(location: string | undefined, board: "private" | "wfh" | "abroad"): InternalLink | undefined {
  if (!location) return undefined
  const hit = CITY_HUBS.find(c => new RegExp(`\\b${c}\\b`, "i").test(location))
  if (!hit) return undefined
  const city = hit === "Bengaluru" ? "Bangalore" : hit
  const slug = city.toLowerCase()
  if (CITY_LANDING_SLUGS.has(slug)) {
    return { href: `/jobs-in-${slug}`, label: `Jobs in ${city}` }
  }
  return { href: `/jobs/${board}?location=${encodeURIComponent(city)}`, label: `Jobs in ${city}` }
}
