import { ORG_LOGO, SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, siteUrl } from "./constants"

export type JobPostingSchemaInput = {
  title: string
  description: string
  url: string
  datePosted?: string
  validThrough?: string
  employmentType?: string
  organizationName: string
  organizationUrl?: string
  organizationLogo?: string
  location: string
  addressLocality?: string
  addressRegion?: string
  addressCountry?: string
  /** Set for fully remote roles — emits jobLocationType TELECOMMUTE. */
  remote?: boolean
  /** Country/ies a remote applicant may be located in. */
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

export function jobPostingSchema(job: JobPostingSchemaInput) {
  const base = siteUrl()
  const datePosted = job.datePosted || new Date().toISOString()
  // Google strongly recommends validThrough; default to 30 days after posting.
  const validThrough =
    job.validThrough || new Date(new Date(datePosted).getTime() + 30 * 86400000).toISOString()

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

  // Remote roles: TELECOMMUTE + applicantLocationRequirements (Google requires
  // this instead of a physical jobLocation for fully remote postings).
  const remoteFields = job.remote
    ? {
        jobLocationType: "TELECOMMUTE",
        applicantLocationRequirements: {
          "@type": "Country",
          name: job.applicantCountry || "India",
        },
      }
    : {}

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.slice(0, 5000),
    datePosted,
    validThrough,
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
        ...(job.addressLocality || job.location ? { addressLocality: job.addressLocality || job.location } : {}),
        ...(job.addressRegion ? { addressRegion: job.addressRegion } : {}),
        addressCountry: job.addressCountry || "IN",
      },
    },
    ...remoteFields,
    ...baseSalary,
    ...(job.identifier
      ? { identifier: { "@type": "PropertyValue", name: job.organizationName, value: job.identifier } }
      : {}),
    url: job.url.startsWith("http") ? job.url : `${base}${job.url}`,
    ...(job.industry ? { industry: job.industry } : {}),
    ...(job.qualifications ? { qualifications: job.qualifications } : {}),
    ...(job.educationRequirements ? { educationRequirements: job.educationRequirements } : {}),
    ...(job.experienceRequirements ? { experienceRequirements: job.experienceRequirements } : {}),
    directApply: true,
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
