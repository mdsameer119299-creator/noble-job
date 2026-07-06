/**
 * Focused assertions for the JobPosting JSON-LD generator (src/lib/seo/schema.ts).
 * Guards the Search Console fixes: ISO-8601 datePosted, structured
 * educationRequirements (EducationalOccupationalCredential) and
 * experienceRequirements (OccupationalExperienceRequirements).
 *
 * Run: npx tsx scripts/verify-job-schema.ts
 */
import { jobPostingSchema } from "../src/lib/seo/schema"

let failed = 0
function ok(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  PASS  ${msg}`)
  } else {
    failed++
    console.error(`  FAIL  ${msg}`)
  }
}

const isIso = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)

const base = {
  title: "Test", description: "d", url: "/jobs/x", organizationName: "Org", location: "Delhi",
}

// datePosted normalization ----------------------------------------------------
{
  const s = jobPostingSchema({ ...base, datePosted: "30 Jun 2026" }) as Record<string, unknown>
  ok(isIso(s.datePosted), "non-ISO datePosted ('30 Jun 2026') normalized to ISO-8601")
  ok(isIso(s.validThrough), "validThrough derived as ISO-8601")
}
{
  const s = jobPostingSchema({ ...base, datePosted: "not-a-date" }) as Record<string, unknown>
  ok(isIso(s.datePosted), "unparseable datePosted falls back to ISO now()")
}
{
  const iso = "2026-01-15T00:00:00.000Z"
  const s = jobPostingSchema({ ...base, datePosted: iso }) as Record<string, unknown>
  ok(s.datePosted === iso, "already-ISO datePosted preserved")
}

// educationRequirements -> EducationalOccupationalCredential ------------------
type Edu = { "@type": string; credentialCategory: string }
const edu = (q: string) =>
  (jobPostingSchema({ ...base, educationRequirements: q }) as { educationRequirements?: Edu })
    .educationRequirements
ok(edu("Any Graduate")?.credentialCategory === "bachelor degree", "'Any Graduate' -> bachelor degree")
ok(edu("B.Tech / B.E")?.credentialCategory === "bachelor degree", "'B.Tech' -> bachelor degree")
ok(edu("Post Graduate / MBA")?.credentialCategory === "postgraduate degree", "'Post Graduate/MBA' -> postgraduate degree")
ok(edu("Diploma in Engineering")?.credentialCategory === "associate degree", "'Diploma' -> associate degree")
ok(edu("ITI")?.credentialCategory === "professional certificate", "'ITI' -> professional certificate")
ok(edu("10th Pass")?.credentialCategory === "high school", "'10th Pass' -> high school")
ok(edu("12th / Intermediate")?.credentialCategory === "high school", "'12th' -> high school")
ok(edu("Any Graduate")?.["@type"] === "EducationalOccupationalCredential", "education emits correct @type")
ok(edu("Qwerty gibberish") === undefined, "unmappable qualification omitted (not invalid text)")

// experienceRequirements -> OccupationalExperienceRequirements ---------------
type Exp = { "@type": string; monthsOfExperience: number }
const exp = (e: string) =>
  (jobPostingSchema({ ...base, experienceRequirements: e }) as { experienceRequirements?: Exp })
    .experienceRequirements
ok(exp("2 years")?.monthsOfExperience === 24, "'2 years' -> 24 months")
ok(exp("2-3 years")?.monthsOfExperience === 24, "'2-3 years' -> min 24 months")
ok(exp("6 months")?.monthsOfExperience === 6, "'6 months' -> 6 months")
ok(exp("Freshers")?.monthsOfExperience === 0, "'Freshers' -> 0 months")
ok(exp("0-2 years")?.monthsOfExperience === 0, "'0-2 years' -> 0 months")
ok(exp("Freshers")?.["@type"] === "OccupationalExperienceRequirements", "experience emits correct @type")
ok(exp("As per norms") === undefined, "non-numeric non-fresher experience omitted")

// omission when no source data -----------------------------------------------
{
  const s = jobPostingSchema(base) as Record<string, unknown>
  ok(!("educationRequirements" in s), "no education input -> property omitted")
  ok(!("experienceRequirements" in s), "no experience input -> property omitted")
  ok(!("baseSalary" in s), "no salary input -> baseSalary omitted")
}

// jobLocation.address ---------------------------------------------------------
type Addr = { streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string; addressCountry?: string }
const addr = (extra: Partial<typeof base> & Record<string, unknown> = {}) =>
  ((jobPostingSchema({ ...base, ...extra }) as { jobLocation: { address: Addr } }).jobLocation.address)
{
  const a = addr()
  ok(a.addressCountry === "IN", "addressCountry defaults to IN")
  ok(!("streetAddress" in a), "no streetAddress input -> omitted (never fabricated)")
  ok(!("postalCode" in a), "no postalCode input -> omitted (never fabricated)")
  ok(!("addressRegion" in a), "no addressRegion input -> omitted")
  ok(!("addressLocality" in a), "raw location no longer leaks as addressLocality (explicit-only)")
}
{
  const a = addr({ addressLocality: "New Delhi" })
  ok(a.addressLocality === "New Delhi", "addressLocality emitted when a real city is supplied")
}
{
  const a = addr({ addressRegion: "Maharashtra" })
  ok(a.addressRegion === "Maharashtra", "addressRegion emitted when state known")
  ok(a.addressCountry === "IN", "addressCountry stays IN when region present")
}
{
  const a = addr({ streetAddress: "Plot 5, Sector 62", postalCode: "201301" })
  ok(a.streetAddress === "Plot 5, Sector 62", "streetAddress emitted only when real data supplied")
  ok(a.postalCode === "201301", "postalCode emitted only when real data supplied")
}

console.log(failed === 0 ? "\nALL SCHEMA ASSERTIONS PASSED" : `\n${failed} ASSERTION(S) FAILED`)
process.exit(failed === 0 ? 0 : 1)
