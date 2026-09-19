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

// A JobPosting needs a REAL datePosted and a real country — neither is ever defaulted.
const base = {
  title: "Test", description: "d", url: "/jobs/x", organizationName: "Org", location: "Delhi",
  datePosted: "2026-01-15T00:00:00.000Z", addressCountry: "IN",
}
const out = (extra: Record<string, unknown> = {}) => jobPostingSchema({ ...base, ...extra } as never) as Record<string, unknown>

// datePosted / validThrough: real dates only ----------------------------------
{
  const s = out({ datePosted: "30 Jun 2026" })
  ok(isIso(s.datePosted), "non-ISO datePosted ('30 Jun 2026') normalized to ISO-8601")
  ok(!("validThrough" in s), "no employer deadline -> validThrough OMITTED (never derived +30d)")
}
{
  ok(jobPostingSchema({ ...base, datePosted: "not-a-date" }) === null, "unparseable datePosted -> NO JobPosting (never now())")
  ok(jobPostingSchema({ ...base, datePosted: undefined }) === null, "missing datePosted -> NO JobPosting")
}
{
  const iso = "2026-01-15T00:00:00.000Z"
  ok(out({ datePosted: iso }).datePosted === iso, "already-ISO datePosted preserved")
}
{
  const s = out({ validThrough: "2099-06-30" })
  ok(isIso(s.validThrough), "a real future employer deadline is emitted as validThrough")
  ok(jobPostingSchema({ ...base, validThrough: "2020-01-01" }) === null, "a real PAST deadline -> JobPosting removed")
}

// educationRequirements -> EducationalOccupationalCredential ------------------
type Edu = { "@type": string; credentialCategory: string }
const edu = (q: string) =>
  (jobPostingSchema({ ...base, educationRequirements: q }) as unknown as { educationRequirements?: Edu })
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
  (jobPostingSchema({ ...base, experienceRequirements: e }) as unknown as { experienceRequirements?: Exp })
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
  const s = out()
  ok(!("educationRequirements" in s), "no education input -> property omitted")
  ok(!("experienceRequirements" in s), "no experience input -> property omitted")
  ok(!("baseSalary" in s), "no salary input -> baseSalary omitted")
}

// jobLocation.address ---------------------------------------------------------
type Addr = { streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string; addressCountry?: string }
const addr = (extra: Record<string, unknown> = {}) =>
  ((jobPostingSchema({ ...base, ...extra } as never) as unknown as { jobLocation: { address: Addr } }).jobLocation.address)
{
  const a = addr()
  ok(a.addressCountry === "IN", "addressCountry is the resolved ISO code of the supplied country")
  ok(jobPostingSchema({ ...base, addressCountry: undefined } as never) === null, "no resolvable country and not remote -> NO JobPosting (no default IN)")
  ok((out({ addressCountry: "United Arab Emirates" }).jobLocation as { address: Addr }).address.addressCountry === "AE", "country names resolve to ISO alpha-2 (UAE -> AE)")
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

// employer identity / employment type / directApply / remote -------------------
{
  const s = out()
  const org = s.hiringOrganization as Record<string, unknown>
  ok(!("logo" in org), "no employer logo supplied -> logo omitted (never the NobleJob logo)")
  ok(!("sameAs" in org), "no employer website supplied -> sameAs omitted")
  ok(!("employmentType" in s), "unknown employment type -> omitted (no default FULL_TIME)")
  ok(!("directApply" in s), "directApply omitted unless explicitly known (never defaults true)")
  ok(!("jobLocationType" in s), "not TELECOMMUTE unless explicitly fully remote")
}
{
  const org = out({ applyUrl: "https://apply.example-ats.com/j/1", organizationSameAs: "https://apply.example-ats.com/j/1" }).hiringOrganization as Record<string, unknown>
  ok(!("sameAs" in org), "sameAs equal to the apply URL is dropped")
  const org2 = out({ applyUrl: "https://apply.example-ats.com/j/1", organizationSameAs: "https://acme.example" }).hiringOrganization as Record<string, unknown>
  ok(org2.sameAs === "https://acme.example/", "sameAs kept when it is the employer's own site")
}
{
  ok(out({ employmentType: "Full Time" }).employmentType === "FULL_TIME", "stated 'Full Time' -> FULL_TIME")
  ok(out({ directApply: false }).directApply === false, "explicit directApply=false emitted")
  const r = out({ remote: true, applicantCountry: "IN", addressCountry: undefined })
  ok(r.jobLocationType === "TELECOMMUTE" && "applicantLocationRequirements" in r, "fully remote + applicant country -> TELECOMMUTE with applicantLocationRequirements")
  ok(!("jobLocation" in r), "remote role without a real address -> NO physical jobLocation (nothing fabricated)")
  ok(jobPostingSchema({ ...base, addressCountry: undefined, remote: true } as never) === null, "remote but no applicant country -> NO JobPosting (no default country)")
}
// description / future date -----------------------------------------------------
{
  ok(jobPostingSchema({ ...base, description: "" } as never) === null, "empty description -> NO JobPosting")
  ok(jobPostingSchema({ ...base, description: "<p> </p>" } as never) === null, "markup-only description -> NO JobPosting")
  ok(jobPostingSchema({ ...base, datePosted: "2099-01-01T00:00:00Z" } as never) === null, "future datePosted -> NO JobPosting")
}

console.log(failed === 0 ? "\nALL SCHEMA ASSERTIONS PASSED" : `\n${failed} ASSERTION(S) FAILED`)
process.exit(failed === 0 ? 0 : 1)
