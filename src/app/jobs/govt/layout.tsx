import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = buildPageMetadata({
  title: "Government Jobs 2026 — Sarkari Naukri | Noble Job",
  description:
    "Latest Government Jobs in India: SSC, UPSC, banking, railway, defence, and state PSC vacancies. Filter by qualification, state, and category on India's job portal.",
  path: "/jobs/govt",
  keywords: ["Government Jobs", "sarkari naukri", "Jobs in India", "SSC jobs", "UPSC jobs"],
})

export default function GovtJobsLayout({ children }: { children: React.ReactNode }) {
  return children
}
