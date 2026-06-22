/**
 * govtTaxonomy.ts — FreeJobAlert-style taxonomy for the Government Jobs section.
 *
 * Single source of truth for:
 *   • Top-level categories (sectors + content types)
 *   • All Indian states & union territories (dedicated pages)
 *   • Qualification-based pages
 *
 * Drives navigation, listing pages, filters, related-jobs widgets and sitemaps.
 */

export type GovtContentType =
  | "jobs"
  | "admit_cards"
  | "results"
  | "answer_keys"
  | "syllabus"
  | "previous_papers"

export interface GovtCategory {
  slug: string
  label: string
  icon: string
  /** Which dataset this category lists. */
  contentType: GovtContentType
  /** Keyword matcher over `${org} ${title} ${post} ${department}` for sector pages. */
  keywords?: string[]
  /** Special scopes for the two India-wide buckets. */
  scope?: "all_india" | "state" | "latest"
  description: string
}

export const GOVT_TOP_CATEGORIES: GovtCategory[] = [
  { slug: "latest-notifications", label: "Latest Notifications", icon: "🆕", contentType: "jobs", scope: "latest", description: "Newest government job notifications across India, updated daily." },
  { slug: "all-india", label: "All India Govt Jobs", icon: "🇮🇳", contentType: "jobs", scope: "all_india", description: "Central government and pan-India recruitment notifications." },
  { slug: "state-govt", label: "State Govt Jobs", icon: "🗺️", contentType: "jobs", scope: "state", description: "State government recruitment across all states & UTs." },
  { slug: "banking", label: "Banking Jobs", icon: "🏦", contentType: "jobs", keywords: ["bank", "sbi", "ibps", "rbi", "nabard", "sidbi"], description: "Bank PO, Clerk, SO and officer recruitment (SBI, IBPS, RBI & more)." },
  { slug: "railway", label: "Railway Jobs", icon: "🚆", contentType: "jobs", keywords: ["rail", "rrb", "rrc", "metro", "dfccil"], description: "Indian Railways RRB / RRC recruitment notifications." },
  { slug: "ssc", label: "SSC Jobs", icon: "📝", contentType: "jobs", keywords: ["ssc", "staff selection"], description: "Staff Selection Commission CGL, CHSL, MTS, GD and more." },
  { slug: "upsc", label: "UPSC Jobs", icon: "🏛", contentType: "jobs", keywords: ["upsc", "union public service"], description: "UPSC Civil Services, CDS, NDA, IES and other exams." },
  { slug: "defence", label: "Defence Jobs", icon: "🪖", contentType: "jobs", keywords: ["army", "navy", "air force", "iaf", "defence", "drdo", "coast guard", "cds", "nda", "agniveer"], description: "Indian Army, Navy, Air Force, DRDO and Agniveer recruitment." },
  { slug: "police", label: "Police Jobs", icon: "👮", contentType: "jobs", keywords: ["police", "constable", "crpf", "bsf", "cisf", "itbp", "ssb", "capf"], description: "State Police, CAPF, CRPF, BSF and constable recruitment." },
  { slug: "teaching", label: "Teaching Jobs", icon: "🍎", contentType: "jobs", keywords: ["teacher", "tet", "professor", "lecturer", "ctet", "ugc", "kvs", "nvs", "faculty"], description: "Teacher, professor and TET recruitment notifications." },
  { slug: "psu", label: "PSU Jobs", icon: "⚙️", contentType: "jobs", keywords: ["ongc", "ntpc", "bhel", "gail", "sail", "iocl", "psu", "coal india", "hpcl", "bpcl", "powergrid"], description: "Public Sector Undertaking recruitment (ONGC, NTPC, BHEL & more)." },
  { slug: "engineering", label: "Engineering Jobs", icon: "🛠️", contentType: "jobs", keywords: ["engineer", "junior engineer", "je", "ae", "technical", "b.tech", "diploma"], description: "Government engineering posts — JE, AE and technical cadres." },
  { slug: "admit-cards", label: "Admit Cards", icon: "🎫", contentType: "admit_cards", description: "Download hall tickets / call letters for upcoming exams." },
  { slug: "results", label: "Results", icon: "🏆", contentType: "results", description: "Latest government exam results and merit lists." },
  { slug: "answer-keys", label: "Answer Keys", icon: "🔑", contentType: "answer_keys", description: "Provisional and final answer keys for government exams." },
  { slug: "syllabus", label: "Syllabus", icon: "📚", contentType: "syllabus", description: "Detailed exam syllabus and pattern for government exams." },
  { slug: "previous-papers", label: "Previous Papers", icon: "📄", contentType: "previous_papers", description: "Previous year question papers for government exam preparation." },
]

export interface IndianRegion { slug: string; label: string; type: "state" | "ut" }

export const INDIAN_STATES: IndianRegion[] = [
  { slug: "andhra-pradesh", label: "Andhra Pradesh", type: "state" },
  { slug: "arunachal-pradesh", label: "Arunachal Pradesh", type: "state" },
  { slug: "assam", label: "Assam", type: "state" },
  { slug: "bihar", label: "Bihar", type: "state" },
  { slug: "chhattisgarh", label: "Chhattisgarh", type: "state" },
  { slug: "goa", label: "Goa", type: "state" },
  { slug: "gujarat", label: "Gujarat", type: "state" },
  { slug: "haryana", label: "Haryana", type: "state" },
  { slug: "himachal-pradesh", label: "Himachal Pradesh", type: "state" },
  { slug: "jharkhand", label: "Jharkhand", type: "state" },
  { slug: "karnataka", label: "Karnataka", type: "state" },
  { slug: "kerala", label: "Kerala", type: "state" },
  { slug: "madhya-pradesh", label: "Madhya Pradesh", type: "state" },
  { slug: "maharashtra", label: "Maharashtra", type: "state" },
  { slug: "manipur", label: "Manipur", type: "state" },
  { slug: "meghalaya", label: "Meghalaya", type: "state" },
  { slug: "mizoram", label: "Mizoram", type: "state" },
  { slug: "nagaland", label: "Nagaland", type: "state" },
  { slug: "odisha", label: "Odisha", type: "state" },
  { slug: "punjab", label: "Punjab", type: "state" },
  { slug: "rajasthan", label: "Rajasthan", type: "state" },
  { slug: "sikkim", label: "Sikkim", type: "state" },
  { slug: "tamil-nadu", label: "Tamil Nadu", type: "state" },
  { slug: "telangana", label: "Telangana", type: "state" },
  { slug: "tripura", label: "Tripura", type: "state" },
  { slug: "uttar-pradesh", label: "Uttar Pradesh", type: "state" },
  { slug: "uttarakhand", label: "Uttarakhand", type: "state" },
  { slug: "west-bengal", label: "West Bengal", type: "state" },
  // Union Territories
  { slug: "andaman-and-nicobar-islands", label: "Andaman & Nicobar Islands", type: "ut" },
  { slug: "chandigarh", label: "Chandigarh", type: "ut" },
  { slug: "dadra-and-nagar-haveli-and-daman-and-diu", label: "Dadra & Nagar Haveli and Daman & Diu", type: "ut" },
  { slug: "delhi", label: "Delhi (NCT)", type: "ut" },
  { slug: "jammu-and-kashmir", label: "Jammu & Kashmir", type: "ut" },
  { slug: "ladakh", label: "Ladakh", type: "ut" },
  { slug: "lakshadweep", label: "Lakshadweep", type: "ut" },
  { slug: "puducherry", label: "Puducherry", type: "ut" },
]

export interface GovtQualification { slug: string; label: string; keywords: string[] }

export const GOVT_QUALIFICATIONS: GovtQualification[] = [
  { slug: "8th-pass", label: "8th Pass", keywords: ["8th", "viii", "8 th", "eighth", "class viii", "class 8"] },
  { slug: "10th-pass", label: "10th Pass", keywords: ["10th", "matric", "sslc", "x ", "tenth", "high school"] },
  { slug: "12th-pass", label: "12th Pass", keywords: ["12th", "intermediate", "10+2", "hsc", "senior secondary"] },
  { slug: "iti", label: "ITI", keywords: ["iti", "industrial training"] },
  { slug: "diploma", label: "Diploma", keywords: ["diploma", "polytechnic"] },
  { slug: "graduate", label: "Graduate", keywords: ["graduation", "graduate", "bachelor", "degree", "b.a", "b.com", "b.sc"] },
  { slug: "post-graduate", label: "Post Graduate", keywords: ["post graduate", "post-graduate", "pg", "master", "m.a", "m.sc", "m.com"] },
  { slug: "b-tech", label: "B.Tech", keywords: ["b.tech", "be", "b.e", "engineering"] },
  { slug: "mba", label: "MBA", keywords: ["mba", "pgdm", "management"] },
  { slug: "mca", label: "MCA", keywords: ["mca", "computer application"] },
]

// ── Lookups ──────────────────────────────────────────────────────────
export const getCategoryBySlug = (slug: string) => GOVT_TOP_CATEGORIES.find(c => c.slug === slug)
export const getStateBySlug = (slug: string) => INDIAN_STATES.find(s => s.slug === slug)
export const getQualificationBySlug = (slug: string) => GOVT_QUALIFICATIONS.find(q => q.slug === slug)

/** Convert any label into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** Best-effort: map a free-text state/location to a region slug. */
export function stateSlugFromName(name?: string): string | undefined {
  if (!name) return undefined
  const s = slugify(name)
  return INDIAN_STATES.find(r => r.slug === s || r.label.toLowerCase() === name.toLowerCase())?.slug
}

/**
 * Central/pan-India markers. When an org/title contains any of these it is a
 * national recruitment even if a state NAME also appears (e.g. "National
 * Institute of Technology Karnataka", "AIIMS Bhopal", "IIT Madras" are central).
 * Guards deriveStateSlugFromText against mis-tagging central bodies as state.
 */
const CENTRAL_MARKERS = [
  "all india", "national", "central", "union public service", "upsc", "ssc",
  "staff selection", "iit", "iim", "nit ", "iiit", "aiims", "iisc", "drdo",
  "isro", "ongc", "ntpc", "bhel", "gail", "sail", "iocl", "ibps", "rbi",
  "sbi", "lic", "railway", "rrb", "rrc", "crpf", "bsf", "cisf", "itbp",
  "indian army", "indian navy", "air force", "coast guard", "esic", "epfo",
]

/**
 * Derive a canonical state slug from an org/title when the row is otherwise
 * untagged. Conservative: matches an Indian state/UT NAME appearing as a whole
 * word, but only if no central marker is present (so central institutions named
 * after a city/state are never relabelled as that state's own recruitment).
 *
 * Used at ingestion to recover state coverage from sources like Employment News
 * that list state-PSC / state-police / state-university recruitments but never
 * populate a structured state field.
 */
export function deriveStateSlugFromText(...parts: (string | undefined)[]): { slug: string; label: string } | undefined {
  const hay = parts.filter(Boolean).join(" ").toLowerCase()
  if (!hay) return undefined
  if (CENTRAL_MARKERS.some(m => hay.includes(m))) return undefined
  for (const r of INDIAN_STATES) {
    const name = r.label.split(" (")[0].toLowerCase() // strip "(NCT)" etc.
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
    if (re.test(hay)) return { slug: r.slug, label: name.replace(/\b\w/g, c => c.toUpperCase()) }
  }
  return undefined
}
