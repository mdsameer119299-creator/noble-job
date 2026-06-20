import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { PolicyPage } from "@/components/legal/PolicyPage"

export const metadata: Metadata = buildPageMetadata({
  title: "Editorial Policy — How Noble Job Sources & Verifies Jobs",
  description:
    "Noble Job's editorial policy explains how we source, write, verify and update job listings and career content to keep information accurate, useful and trustworthy.",
  path: "/editorial-policy",
})

export default function EditorialPolicyPage() {
  return (
    <PolicyPage
      title="Editorial Policy"
      updated="19 June 2026"
      intro="At Noble Job — an initiative of NCC Foundation — our mission is to help job seekers across India find accurate, verified and useful opportunities. This editorial policy explains how our team sources, creates, reviews and updates every job listing and piece of career guidance published on noblejob.in."
      sections={[
        {
          heading: "How We Source Job Listings",
          paragraphs: [
            "Government job notifications are compiled from official sources including the recruiting organisations, their official websites and published recruitment notifications. Private, work-from-home and abroad listings are sourced from verified employers, official company career pages and trusted recruitment partners.",
          ],
          bullets: [
            "Official notifications and government recruitment portals",
            "Verified employer and company career pages",
            "Trusted recruitment and staffing partners",
            "Direct submissions from registered, verified employers on Noble Job",
          ],
        },
        {
          heading: "How We Verify Information",
          paragraphs: [
            "Before a listing is published, key details — organisation name, role, eligibility, vacancies, salary, important dates and the official application link — are checked against the original source. Listings link out to the official application page so candidates can confirm details first-hand.",
          ],
        },
        {
          heading: "Accuracy, Corrections & Updates",
          paragraphs: [
            "Recruitment details can change. We update listings as new information becomes available and clearly mark closed or expired postings. If you spot an error, contact us and we will review and correct it promptly.",
            "Each job page carries a disclaimer reminding candidates to verify all details on the official notification before applying.",
          ],
        },
        {
          heading: "Editorial Independence",
          paragraphs: [
            "Career guidance and informational content are written to serve job seekers, not advertisers. Listing a job does not constitute endorsement of an employer. We never charge candidates to view or apply for jobs.",
          ],
        },
        {
          heading: "Our Commitment to Candidates",
          bullets: [
            "Free access — Noble Job never charges job seekers",
            "Transparency — every listing links to its official source",
            "Anti-fraud — we remove suspicious listings and warn against fee-charging scams",
            "Privacy — your data is handled per our Privacy Policy",
          ],
        },
      ]}
    />
  )
}
