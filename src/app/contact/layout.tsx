import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Noble Job — Support & Employer Enquiries",
  description:
    "Contact Noble Job for candidate support, employer hiring, and partnership enquiries. Job Portal India help desk by NCC Foundation.",
  path: "/contact",
})

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
