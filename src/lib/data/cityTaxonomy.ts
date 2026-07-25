/**
 * Tail-city taxonomy — the long tail beyond the 8 hand-authored, 1500-word
 * city hubs in landingCities.ts. These cities get a data-derived (not
 * editorial-prose) page under /jobs-in/[city], generated the same way the
 * city x category pages in cityCategoryLanding.ts are: real job counts, real
 * company/role names, gated on a minimum live-job threshold so a city with
 * no real inventory never gets an indexed page. Add a city here (kept in
 * sync with the LOCATIONS list in jobInventory.ts) to extend coverage —
 * the routes, sitemap and gating all key off this single list.
 */

export interface TailCityDef {
  slug: string
  city: string
  state: string
  /** Substring matched against private-job `location`. */
  locationQuery: string
  accent: string
  /** Govt state taxonomy slug for the "state government jobs" link. */
  govtStateSlug?: string
}

export const TAIL_CITIES: TailCityDef[] = [
  { slug: "kolkata", city: "Kolkata", state: "West Bengal", locationQuery: "Kolkata", accent: "#0f766e", govtStateSlug: "west-bengal" },
  { slug: "ahmedabad", city: "Ahmedabad", state: "Gujarat", locationQuery: "Ahmedabad", accent: "#b45309", govtStateSlug: "gujarat" },
  { slug: "surat", city: "Surat", state: "Gujarat", locationQuery: "Surat", accent: "#c2410c", govtStateSlug: "gujarat" },
  { slug: "vadodara", city: "Vadodara", state: "Gujarat", locationQuery: "Vadodara", accent: "#9333ea", govtStateSlug: "gujarat" },
  { slug: "jaipur", city: "Jaipur", state: "Rajasthan", locationQuery: "Jaipur", accent: "#be123c", govtStateSlug: "rajasthan" },
  { slug: "lucknow", city: "Lucknow", state: "Uttar Pradesh", locationQuery: "Lucknow", accent: "#0369a1", govtStateSlug: "uttar-pradesh" },
  { slug: "kanpur", city: "Kanpur", state: "Uttar Pradesh", locationQuery: "Kanpur", accent: "#7c2d12", govtStateSlug: "uttar-pradesh" },
  { slug: "varanasi", city: "Varanasi", state: "Uttar Pradesh", locationQuery: "Varanasi", accent: "#b45309", govtStateSlug: "uttar-pradesh" },
  { slug: "indore", city: "Indore", state: "Madhya Pradesh", locationQuery: "Indore", accent: "#6d28d9", govtStateSlug: "madhya-pradesh" },
  { slug: "bhopal", city: "Bhopal", state: "Madhya Pradesh", locationQuery: "Bhopal", accent: "#047857", govtStateSlug: "madhya-pradesh" },
  { slug: "chandigarh", city: "Chandigarh", state: "Chandigarh", locationQuery: "Chandigarh", accent: "#1d4ed8", govtStateSlug: "chandigarh" },
  { slug: "amritsar", city: "Amritsar", state: "Punjab", locationQuery: "Amritsar", accent: "#dc2626", govtStateSlug: "punjab" },
  { slug: "ludhiana", city: "Ludhiana", state: "Punjab", locationQuery: "Ludhiana", accent: "#0e7490", govtStateSlug: "punjab" },
  { slug: "patna", city: "Patna", state: "Bihar", locationQuery: "Patna", accent: "#059669", govtStateSlug: "bihar" },
  { slug: "kochi", city: "Kochi", state: "Kerala", locationQuery: "Kochi", accent: "#0d9488", govtStateSlug: "kerala" },
  { slug: "thiruvananthapuram", city: "Thiruvananthapuram", state: "Kerala", locationQuery: "Thiruvananthapuram", accent: "#7c3aed", govtStateSlug: "kerala" },
  { slug: "coimbatore", city: "Coimbatore", state: "Tamil Nadu", locationQuery: "Coimbatore", accent: "#1847d4", govtStateSlug: "tamil-nadu" },
  { slug: "nagpur", city: "Nagpur", state: "Maharashtra", locationQuery: "Nagpur", accent: "#e11d48", govtStateSlug: "maharashtra" },
  { slug: "nashik", city: "Nashik", state: "Maharashtra", locationQuery: "Nashik", accent: "#0369a1", govtStateSlug: "maharashtra" },
  { slug: "mysore", city: "Mysore", state: "Karnataka", locationQuery: "Mysore", accent: "#b45309", govtStateSlug: "karnataka" },
  { slug: "visakhapatnam", city: "Visakhapatnam", state: "Andhra Pradesh", locationQuery: "Visakhapatnam", accent: "#0f766e", govtStateSlug: "andhra-pradesh" },
  { slug: "vijayawada", city: "Vijayawada", state: "Andhra Pradesh", locationQuery: "Vijayawada", accent: "#7c2d12", govtStateSlug: "andhra-pradesh" },
  { slug: "bhubaneswar", city: "Bhubaneswar", state: "Odisha", locationQuery: "Bhubaneswar", accent: "#9333ea", govtStateSlug: "odisha" },
  { slug: "guwahati", city: "Guwahati", state: "Assam", locationQuery: "Guwahati", accent: "#059669", govtStateSlug: "assam" },
  { slug: "dehradun", city: "Dehradun", state: "Uttarakhand", locationQuery: "Dehradun", accent: "#0e7490", govtStateSlug: "uttarakhand" },
  { slug: "ranchi", city: "Ranchi", state: "Jharkhand", locationQuery: "Ranchi", accent: "#be123c", govtStateSlug: "jharkhand" },
  { slug: "raipur", city: "Raipur", state: "Chhattisgarh", locationQuery: "Raipur", accent: "#c2410c", govtStateSlug: "chhattisgarh" },
  { slug: "faridabad", city: "Faridabad", state: "Haryana", locationQuery: "Faridabad", accent: "#1d4ed8", govtStateSlug: "haryana" },
]

const TAIL_CITY_BY_SLUG = new Map(TAIL_CITIES.map(c => [c.slug, c]))

export function getTailCityBySlug(slug: string): TailCityDef | undefined {
  return TAIL_CITY_BY_SLUG.get(slug)
}
