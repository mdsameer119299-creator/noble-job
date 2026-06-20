import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { PolicyPage } from "@/components/legal/PolicyPage"

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy — Noble Job",
  description:
    "How Noble Job (an initiative of NCC Foundation) collects, uses, stores and protects your personal data, and the rights you have over your information.",
  path: "/privacy-policy",
})

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      updated="19 June 2026"
      intro="This Privacy Policy explains how Noble Job — an initiative of NCC Foundation — collects, uses, discloses and safeguards your information when you use noblejob.in. By using our platform, you agree to the practices described below."
      sections={[
        {
          heading: "Information We Collect",
          bullets: [
            "Account details you provide: name, email, phone number and password",
            "Profile and resume data: qualifications, experience, skills and documents you upload",
            "Application activity: jobs you view, save and apply to",
            "Technical data: IP address, device, browser and usage analytics",
          ],
        },
        {
          heading: "How We Use Your Information",
          bullets: [
            "To create and manage your account and job applications",
            "To match you with relevant jobs and send job alerts you opt into",
            "To share your application with the relevant employer when you apply",
            "To improve our services, security and user experience",
            "To communicate important updates and respond to your queries",
          ],
        },
        {
          heading: "Sharing of Information",
          paragraphs: [
            "When you apply for a job, the relevant details and resume are shared with that employer. We do not sell your personal data. We may share data with service providers (e.g. hosting, email) under confidentiality obligations, or where required by law.",
          ],
        },
        {
          heading: "Data Security & Retention",
          paragraphs: [
            "We use industry-standard safeguards to protect your data and retain it only as long as needed to provide our services or as required by law. No method of transmission over the internet is completely secure, so we encourage strong passwords and caution when sharing information.",
          ],
        },
        {
          heading: "Your Rights & Choices",
          bullets: [
            "Access, update or correct your profile information at any time",
            "Unsubscribe from job alerts and marketing emails",
            "Request deletion of your account and associated data",
            "Control cookie preferences through your browser settings",
          ],
        },
        {
          heading: "Cookies",
          paragraphs: [
            "We use cookies and similar technologies to keep you signed in, remember preferences and understand how the site is used. You can disable cookies in your browser, though some features may not work as intended.",
          ],
        },
      ]}
    />
  )
}
