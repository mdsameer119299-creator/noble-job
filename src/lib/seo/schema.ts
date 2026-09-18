import { ORG_LOGO, SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, siteUrl } from "./constants"

export type JobPostingSchemaInput = {
  title: string
  description: string
  url: string
  datePosted: string
  validThrough?: string
  employmentType?: string
  organizationName: string
  organizationUrl?: string
  organizationLogo?: string
  location: string
  addressLocality?: string
  addressRegion?: string
  addressCountry?: string
  streetAddress?: string
  postalCode?: string
  remote?: boolean
  applicantCountry?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryUnit?: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR"
  industry?: string
  qualifications?: string
  educationRequirements?: string
  experienceRequirements?: string
  identifier?: string
  /** Only emit when the specific posting supports direct application as defined by Google. */
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
    description: "India's job portal for Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs.",
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
      target: { "@type": "EntryPoint", urlTemplate: `${base}/jobs/private?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
    inLanguage: "en-IN",
  }
}

function toIsoOrUndefined(input?: string): string | undefined {
  if (!input) return undefined
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

const EDUCATION_CREDENTIAL_RULES: { re: RegExp; category: string }[] = [
  { re: /\\bph\\.?\\s?d\\b|\\bdoctorate\\b|\\bdoctoral\\b/i, category: "postgraduate degree" },
  { re: /\\bpost[\\s-]?grad|\\bpg\\b|\\bmaster|\\bm\\.?\\s?a\\b|\\bm\\.?\\s?sc|\\bm\\.?\\s?com|\\bm\\.?\\s?tech|\\bm\\.?\\s?e\\b|\\bmba\\b|\\bmca\\b|\\bm\\.?\\s?phil|\\bll\\.?\\s?m\\b/i, category: "postgraduate degree" },
  { re: /\\bgraduat|\\bbachelor|\\bdegree|\\bb\\.?\\s?a\\b|\\bb\\.?\\s?sc|\\bb\\.?\\s?com|\\bb\\.?\\s?tech|\\bb\\.?\\s?e\\b|\\bbba\\b|\\bbca\\b|\\bll\\.?\\s?b\\b|\\bmbbs\\b|\\bb\\.?\\s?ed/i, category: "bachelor degree" },
  { re: /\\bdiploma|\\bpolytechnic/i, category: "associate degree" },
  { re: /\\biti\\b|\\bcertificat/i, category: "professional certificate" },
  { re: /\\b12th|\\b10th|\\bmatric|\\bsslc|\\bhsc\\b|\\bintermediate|\\bhigher secondary|\\bsenior secondary|\\bpuc\\b|\\bhigh school|\\bsecondary/i, category: "high school" },
]
function educationCredential(q?: string) {
  if (!q) return undefined
  for (const rule of EDUCATION_CREDENTIAL_RULES) if (rule.re.test(q)) return { "@type": "EducationalOccupationalCredential", credentialCategory: rule.category }
  return undefined
}

function experienceMonths(raw?: string): number | undefined {
  if (!raw) return undefined
  const s = raw.toLowerCase().trim()
  if (!s) return undefined
  const num = s.match(/\\d+(?:\\.\\d+)?/)
  if (!num) return /fresher|fresh\\b|entry[\\s-]?level|no experience/.test(s) ? 0 : undefined
  const n = parseFloat(num[0])
  if (!Number.isFinite(n)) return undefined
  const months = /month|mos\\b/.test(s) ? n : n * 12
  const rounded = Math.round(months)
  return rounded >= 0 && rounded <= 600 ? rounded : undefined
}

export function jobPostingSchema(job: JobPostingSchemaInput) {
  const base = siteUrl()
  const datePosted = toIsoOrUndefined(job.datePosted)
  if (!datePosted) throw new Error("JobPosting schema requires a valid datePosted")
  const validThrough = toIsoOrUndefined(job.validThrough)
  const educationCred = educationCredential(job.educationRequirements)
  const expMonths = experienceMonths(job.experienceRequirements)

  const baseSalary = typeof job.salaryMin === "number" && Number.isFinite(job.salaryMin)
    ? { baseSalary: { "@type": "MonetaryAmount", currency: job.salaryCurrency || "INR", value: { "@type": "QuantitativeValue", minValue: job.salaryMin, maxValue: typeof job.salaryMax === "number" ? job.salaryMax : job.salaryMin, unitText: job.salaryUnit || "MONTH" } } }
    : {}

  const remoteFields = job.remote
    ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: job.applicantCountry || "India" } }
    : {}

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.slice(0, 5000),
    datePosted,
    ...(validThrough ? { validThrough } : {}),
    employmentType: job.employmentType || "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: job.organizationName,
      logo: job.organizationLogo || `${base}${ORG_LOGO}`,
      ...(job.organizationUrl ? { sameAs: job.organizationUrl } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.streetAddress ? { streetAddress: job.streetAddress } : {}),
        ...(job.addressLocality ? { addressLocality: job.addressLocality } : {}),
        ...(job.addressRegion ? { addressRegion: job.addressRegion } : {}),
        ...(job.postalCode ? { postalCode: job.postalCode } : {}),
        addressCountry: job.addressCountry || "IN",
      },
    },
    ...remoteFields,
    ...baseSalary,
    ...(job.identifier ? { identifier: { "@type": "PropertyValue", name: job.organizationName, value: job.identifier } } : {}),
    url: job.url.startsWith("http") ? job.url : `${base}${job.url}`,
    ...(job.industry ? { industry: job.industry } : {}),
    ...(job.qualifications ? { qualifications: job.qualifications } : {}),
    ...(educationCred ? { educationRequirements: educationCred } : {}),
    ...(expMonths !== undefined ? { experienceRequirements: { "@type": "OccupationalExperienceRequirements", monthsOfExperience: expMonths } } : {}),
    ...(job.directApply !== undefined ? { directApply: job.directApply } : {}),
  }
}

export type ArticleSchemaInput = {
  headline: string
  description: string
  url: string
  datePublished: string
  dateModified?: string
  section?: string
  image?: string
}

export function articleSchema(a: ArticleSchemaInput) {
  const base = siteUrl()
  const url = a.url.startsWith("http") ? a.url : `${base}${a.url}`
  const image = a.image ? (a.image.startsWith("http") ? a.image : `${base}${a.image}`) : `${base}${ORG_LOGO}`
  return {
    "@context": "https://schema.org", "@type": "Article", headline: a.headline.slice(0, 110), description: a.description,
    image: [image], datePublished: a.datePublished, dateModified: a.dateModified || a.datePublished,
    ...(a.section ? { articleSection: a.section } : {}), inLanguage: "en-IN", mainEntityOfPage: { "@type": "WebPage", "@id": url }, url,
    author: { "@type": "Organization", name: SITE_NAME, url: base },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${base}${ORG_LOGO}` } },
  }
}

export function breadcrumbSchema(items: { name: string; path?: string }[]) {
  const base = siteUrl()
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, ...(item.path ? { item: `${base}${item.path}` } : {}) })) }
}

export function itemListSchema(items: { name: string; url: string }[], name?: string) {
  const base = siteUrl()
  return { "@context": "https://schema.org", "@type": "ItemList", ...(name ? { name } : {}), numberOfItems: items.length, itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: it.url.startsWith("http") ? it.url : `${base}${it.url}` })) }
}

export function faqPageSchema(faqs: { question: string; answer: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(f => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }
}
