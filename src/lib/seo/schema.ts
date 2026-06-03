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
  location: string
  addressCountry?: string
  salary?: string
  industry?: string
  qualifications?: string
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
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.slice(0, 5000),
    datePosted: job.datePosted || new Date().toISOString(),
    ...(job.validThrough ? { validThrough: job.validThrough } : {}),
    employmentType: job.employmentType || "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: job.organizationName,
      ...(job.organizationUrl ? { sameAs: job.organizationUrl } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location,
        addressCountry: job.addressCountry || "IN",
      },
    },
    ...(job.salary
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "INR",
            value: { "@type": "QuantitativeValue", value: job.salary, unitText: "YEAR" },
          },
        }
      : {}),
    identifier: job.identifier
      ? { "@type": "PropertyValue", name: job.organizationName, value: job.identifier }
      : undefined,
    url: job.url.startsWith("http") ? job.url : `${base}${job.url}`,
    industry: job.industry,
    qualifications: job.qualifications,
    directApply: true,
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
