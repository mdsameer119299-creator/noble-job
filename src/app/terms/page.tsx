import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { PolicyPage } from "@/components/legal/PolicyPage"

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service — Noble Job",
  description:
    "The terms and conditions governing your use of Noble Job (noblejob.in), an initiative of NCC Foundation — covering accounts, acceptable use, listings and liability.",
  path: "/terms",
})

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      updated="19 June 2026"
      intro="These Terms of Service govern your use of noblejob.in, operated by Noble Job — an initiative of NCC Foundation. By accessing or using our platform, you agree to these terms. Please read them carefully."
      sections={[
        {
          heading: "Use of the Platform",
          paragraphs: [
            "Noble Job provides a platform to discover and apply for government, private, work-from-home and abroad jobs. You agree to use the platform lawfully and not to misuse, disrupt or attempt to gain unauthorised access to any part of it.",
          ],
        },
        {
          heading: "Accounts",
          bullets: [
            "You are responsible for the accuracy of the information you provide",
            "You must keep your login credentials confidential",
            "You are responsible for activity under your account",
            "We may suspend accounts that violate these terms or applicable law",
          ],
        },
        {
          heading: "Job Listings & Third Parties",
          paragraphs: [
            "Noble Job aggregates and verifies listings but is not the employer for the roles listed. We do not guarantee employment, the accuracy of every third-party listing, or the conduct of employers. Always verify details on the official application page and review our Job Verification Policy.",
          ],
        },
        {
          heading: "No Fees to Job Seekers",
          paragraphs: [
            "Job seekers can use Noble Job free of charge. We never ask candidates to pay to view or apply for jobs. Report anyone demanding payment in our name.",
          ],
        },
        {
          heading: "Intellectual Property",
          paragraphs: [
            "The Noble Job name, logo, design and original content are the property of NCC Foundation and protected by law. You may not copy, reproduce or redistribute our content without permission.",
          ],
        },
        {
          heading: "Limitation of Liability",
          paragraphs: [
            "The platform is provided 'as is'. To the maximum extent permitted by law, Noble Job and NCC Foundation are not liable for any indirect or consequential losses arising from use of the platform, third-party listings, or employer conduct.",
          ],
        },
        {
          heading: "Changes to These Terms",
          paragraphs: [
            "We may update these terms from time to time. Continued use of the platform after changes take effect constitutes acceptance of the revised terms.",
          ],
        },
      ]}
    />
  )
}
