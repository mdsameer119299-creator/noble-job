import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { PolicyPage } from "@/components/legal/PolicyPage"

export const metadata: Metadata = buildPageMetadata({
  title: "Job Verification Policy — How Noble Job Protects Job Seekers",
  description:
    "Learn how Noble Job verifies employers and job listings, fights recruitment fraud, and the steps every candidate should take to stay safe while applying for jobs.",
  path: "/job-verification-policy",
})

export default function JobVerificationPolicyPage() {
  return (
    <PolicyPage
      title="Job Verification Policy"
      updated="19 June 2026"
      intro="Noble Job is committed to a safe, scam-free job search. This policy describes how we verify employers and listings, how we handle suspicious activity, and how you can protect yourself while applying for jobs."
      sections={[
        {
          heading: "Employer & Listing Verification",
          paragraphs: [
            "Employers who post on Noble Job are reviewed before their listings go live. We check business details, official email domains and the legitimacy of the role. Government listings are cross-checked against official recruitment notifications.",
          ],
          bullets: [
            "Verification of employer identity and contact details",
            "Validation of the official application link or career page",
            "Review of role details, eligibility and salary for plausibility",
            "Monitoring for duplicate, expired or misleading postings",
          ],
        },
        {
          heading: "Noble Job Never Charges Candidates",
          paragraphs: [
            "Applying for any job on Noble Job is completely free. We will never ask you to pay a fee, deposit or 'registration charge' to apply, interview or receive an offer. Any such demand is a clear sign of fraud.",
          ],
        },
        {
          heading: "How to Spot a Fake Job Offer",
          bullets: [
            "A request for money, gift cards or bank/UPI details to 'secure' a job",
            "Offers received without any interview or assessment",
            "Communication only from free email accounts, not official company domains",
            "Pressure to act immediately or share OTPs and passwords",
            "Salary or perks that seem far too good for the role",
          ],
        },
        {
          heading: "Reporting a Suspicious Listing",
          paragraphs: [
            "If a listing or message seems fraudulent, stop all contact and report it to us immediately. We investigate every report and remove confirmed fraudulent listings and employers from the platform.",
          ],
        },
        {
          heading: "Your Responsibility as a Candidate",
          paragraphs: [
            "Always confirm role details on the official application page linked from each job. Never share sensitive financial information or one-time passwords. When in doubt, verify directly with the organisation through its official website.",
          ],
        },
      ]}
    />
  )
}
