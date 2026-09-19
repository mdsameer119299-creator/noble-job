import { ORG_LOGO, SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, siteUrl } from "./constants"
import {
  cleanHttpUrl,
  isPast,
  normalizeEmploymentType,
  parseRealDate,
  resolveCountryIso,
  sameUrl,
} from "./jobPostingRules"

export type JobPostingSchemaInput = {
  title: string
  description: string
  url: string
  /**
   * REAL first-publication date from the stored record. Required: when it is
   * missing or unparseable `jobPostingSchema` returns `null` (no JobPosting)
   * rather than substituting the current time.
   */
  datePosted?: string
  /**
   * The employer's REAL application deadline, when one exists. Never derive it
   * from `datePosted`, and never pass NobleJob's internal review date here. When
   * omitted, `validThrough` is omitted. A deadline already in the past means the
   * job is closed, so no JobPosting is emitted.
   */
  validThrough?: string
  /** Free text from the record; mapped to a schema.org value or omitted. */
  employmentType?: string
  organizationName: string
  /**
   * The EMPLOYER's or SOURCE's own website (never an application URL, an ATS
   * link or a NobleJob page). Emitted as `hiringOrganization.sameAs` only when
   * it is a real http(s) URL that differs from `applyUrl`.
   */
  organizationSameAs?: string
  /** The application URL — used only to make sure it is never emitted as `sameAs`. */
  applyUrl?: string
  /** The EMPLOYER's own logo URL. There is no fallback to a NobleJob asset. */
  organizationLogo?: string
  location: string
  addressLocality?: string
  addressRegion?: string
  /** ISO 3166-1 alpha-2. If it cannot be resolved (and the role is not remote) no JobPosting is emitted. */
  addressCountry?: string
  /** Only pass when a real street address exists — never fabricate. */
  streetAddress?: string
  /** Only pass when a real postal/PIN code exists — never fabricate. */
  postalCode?: string
  /**
   * Set ONLY when the stored record explicitly says the role is fully remote.
   * Requires `applicantCountry`; without it TELECOMMUTE is not emitted.
   */
  remote?: boolean
  /** Country a remote applicant may be located in (name or ISO alpha-2). */
  applicantCountry?: string
  /** Structured pay (preferred). When present, a valid baseSalary is emitted. */
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryUnit?: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR"
  industry?: string
  qualifications?: string
  educationRequirements?: string
  experienceRequirements?: string
  identifier?: string
  /**
   * `directApply` is emitted ONLY when the caller passes an explicit boolean —
   * there is no default. Pass `true` only when the application is delivered to
   * the employer through NobleJob itself; aggregated, curated and government
   * postings that send candidates to a third-party site pass `false`.
   */
  directApply?: boolean
}

export function organizationSchema() {
  const base = siteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: SITE_NAME,
    legalName: "Noble Job — An Initiative of NCC Foundation",
    url: base,
    logo: `${base}${ORG_LOGO}`,
    email: SUPPORT_EMAIL,
    telephone: SUPPORT_PHONE,
    sameAs: [
      "https://www.linkedin.com/company/noblejob",
      "https://www.facebook.com/noblejob",
      "https://www.instagram.com/noblejob",
    ],
    description:
      "India's job portal for Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs.",
    areaServed: { "@type": "Country", name: "India" },
  }
}

export function websiteSchema() {
  const base = siteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: SITE_NAME,
    url: base,
    description: "Job Portal India — Jobs in India across government, private, WFH, and abroad sectors.",
    publisher: { "@id": `${base}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/jobs/private?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: "en-IN",
  }
}

/**
 * Map a free-text qualification to a Google-recognized credentialCategory.
 * Google requires educationRequirements to be an EducationalOccupationalCredential
 * (a plain string is flagged "invalid"). Rules are ordered most-specific first;
 * returns undefined when no confident mapping exists so the caller omits the
 * property rather than emitting a guessed/invalid value.
 */
const EDUCATION_CREDENTIAL_RULES: { re: RegExp; category: string }[] = [
  { re: /\bph\.?\s?d\b|\bdoctorate\b|\bdoctoral\b/i, category: "postgraduate degree" },
  { re: /\bpost[\s-]?grad|\bpg\b|\bmaster|\bm\.?\s?a\b|\bm\.?\s?sc|\bm\.?\s?com|\bm\.?\s?tech|\bm\.?\s?e\b|\bmba\b|\bmca\b|\bm\.?\s?phil|\bll\.?\s?m\b/i, category: "postgraduate degree" },
  { re: /\bgraduat|\bbachelor|\bdegree|\bb\.?\s?a\b|\bb\.?\s?sc|\bb\.?\s?com|\bb\.?\s?tech|\bb\.?\s?e\b|\bbba\b|\bbca\b|\bll\.?\s?b\b|\bmbbs\b|\bb\.?\s?ed/i, category: "bachelor degree" },
  { re: /\bdiploma|\bpolytechnic/i, category: "associate degree" },
  { re: /\biti\b|\bcertificat/i, category: "professional certificate" },
  { re: /\b12th|\b10th|\bmatric|\bsslc|\bhsc\b|\bintermediate|\bhigher secondary|\bsenior secondary|\bpuc\b|\bhigh school|\bsecondary/i, category: "high school" },
]
function educationCredential(q?: string) {
  if (!q) return undefined
  for (const rule of EDUCATION_CREDENTIAL_RULES) {
    if (rule.re.test(q)) {
      return { "@type": "EducationalOccupationalCredential", credentialCategory: rule.category }
    }
  }
  return undefined
}

/**
 * Parse a free-text experience requirement to whole months for a valid
 * OccupationalExperienceRequirements. Google flags a plain-string
 * experienceRequirements as "invalid". Returns undefined when no number is
 * present and the text isn't clearly fresher/entry-level, so the caller omits it.
 */
function experienceMonths(raw?: string): number | undefined {
  if (!raw) return undefined
  const s = raw.toLowerCase().trim()
  if (!s) return undefined
  const num = s.match(/\d+(?:\.\d+)?/)
  if (!num) {
    return /fresher|fresh\b|entry[\s-]?level|no experience/.test(s) ? 0 : undefined
  }
  const n = parseFloat(num[0])
  if (!Number.isFinite(n)) return undefined
  const months = /month|mos\b/.test(s) ? n : n * 12
  const rounded = Math.round(months)
  return rounded >= 0 && rounded <= 600 ? rounded : undefined
}

/**
 * Build a schema.org JobPosting, or return `null` when the record cannot
 * truthfully support one. Callers MUST handle `null` (emit nothing).
 *
 * Returns `null` when:
 *  - there is no real, parseable `datePosted`;
 *  - a real `validThrough` deadline exists and is already past (job closed);
 *  - the role has neither a resolvable country nor a valid remote applicant
 *    country (Google requires one of them).
 */
export function jobPostingSchema(job: JobPostingSchemaInput) {
  const base = siteUrl()

  // datePosted must be a real stored date. Never `new Date()`.
  const datePosted = parseRealDate(job.datePosted)
  if (!datePosted) return null

  // validThrough only from a real employer deadline. Never derived (+30d etc.).
  const validThrough = parseRealDate(job.validThrough)
  if (validThrough && isPast(validThrough)) return null

  const educationCred = educationCredential(job.educationRequirements)
  const expMonths = experienceMonths(job.experienceRequirements)

  // baseSalary must be numeric for Google Rich Results — only emit when we have
  // a parsed amount (an invalid string baseSalary is worse than none).
  const baseSalary =
    typeof job.salaryMin === "number" && Number.isFinite(job.salaryMin)
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.salaryCurrency || "INR",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salaryMin,
              maxValue: typeof job.salaryMax === "number" ? job.salaryMax : job.salaryMin,
              unitText: job.salaryUnit || "MONTH",
            },
          },
        }
      : {}

  // Remote: TELECOMMUTE needs applicantLocationRequirements. Emitted only when
  // the caller established the role is fully remote AND supplied a country.
  const applicantIso = resolveCountryIso(job.applicantCountry)
  const remote = Boolean(job.remote && applicantIso)
  const remoteFields = remote
    ? {
        jobLocationType: "TELECOMMUTE",
        applicantLocationRequirements: { "@type": "Country", name: applicantIso },
      }
    : {}

  // Physical location: requires a real ISO country. No default country.
  const countryIso = resolveCountryIso(job.addressCountry)
  if (!countryIso && !remote) return null
  const jobLocation = countryIso
    ? {
        jobLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            // streetAddress / postalCode are emitted only when the caller supplies
            // real data — a fabricated value is worse than an omitted one.
            ...(job.streetAddress ? { streetAddress: job.streetAddress } : {}),
            // addressLocality only for a real city (never a state / "All India").
            ...(job.addressLocality ? { addressLocality: job.addressLocality } : {}),
            ...(job.addressRegion ? { addressRegion: job.addressRegion } : {}),
            ...(job.postalCode ? { postalCode: job.postalCode } : {}),
            addressCountry: countryIso,
          },
        },
      }
    : {}

  const employmentType = normalizeEmploymentType(job.employmentType)

  // Employer identity: own logo only, sameAs only from an employer/source site.
  const logo = cleanHttpUrl(job.organizationLogo)
  const sameAs = cleanHttpUrl(job.organizationSameAs)
  const emitSameAs = sameAs && !sameUrl(sameAs, job.applyUrl) ? sameAs : undefined

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.slice(0, 5000),
    datePosted,
    ...(validThrough ? { validThrough } : {}),
    ...(employmentType ? { employmentType } : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: job.organizationName,
      ...(logo ? { logo } : {}),
      ...(emitSameAs ? { sameAs: emitSameAs } : {}),
    },
    ...jobLocation,
    ...remoteFields,
    ...baseSalary,
    ...(job.identifier
      ? { identifier: { "@type": "PropertyValue", name: job.organizationName, value: job.identifier } }
      : {}),
    url: job.url.startsWith("http") ? job.url : `${base}${job.url}`,
    ...(job.industry ? { industry: job.industry } : {}),
    ...(job.qualifications ? { qualifications: job.qualifications } : {}),
    ...(educationCred ? { educationRequirements: educationCred } : {}),
    ...(expMonths !== undefined
      ? { experienceRequirements: { "@type": "OccupationalExperienceRequirements", monthsOfExperience: expMonths } }
      : {}),
    ...(typeof job.directApply === "boolean" ? { directApply: job.directApply } : {}),
  }
}

export type ArticleSchemaInput = {
  headline: string
  description: string
  url: string
  datePublished: string
  dateModified?: string
  section?: string
  /** Absolute or site-relative image URL. */
  image?: string
}

/** Schema.org Article for guide/blog pages. */
export function articleSchema(a: ArticleSchemaInput) {
  const base = siteUrl()
  const url = a.url.startsWith("http") ? a.url : `${base}${a.url}`
  const image = a.image
    ? a.image.startsWith("http")
      ? a.image
      : `${base}${a.image}`
    : `${base}${ORG_LOGO}`
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.headline.slice(0, 110),
    description: a.description,
    image: [image],
    datePublished: a.datePublished,
    dateModified: a.dateModified || a.datePublished,
    ...(a.section ? { articleSection: a.section } : {}),
    inLanguage: "en-IN",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: base,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${base}${ORG_LOGO}` },
    },
  }
}

export function breadcrumbSchema(items: { name: string; path?: string }[]) {
  const base = siteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: `${base}${item.path}` } : {}),
    })),
  }
}

/**
 * ItemList schema for a listing/collection page (e.g. a state's job listings).
 * `url` may be site-relative; it is absolutised. Position is 1-based.
 */
export function itemListSchema(items: { name: string; url: string }[], name?: string) {
  const base = siteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(name ? { name } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url.startsWith("http") ? it.url : `${base}${it.url}`,
    })),
  }
}

export function faqPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }
}
