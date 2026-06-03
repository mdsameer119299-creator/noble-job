import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = buildPageMetadata({
  title: "Abroad Jobs for Indians — International Careers | Noble Job",
  description:
    "Find Abroad Jobs in USA, UK, Canada, UAE, Germany, and more. International job listings for Indian professionals on Noble Job Portal India.",
  path: "/jobs/abroad",
  keywords: ["Abroad Jobs", "jobs abroad for Indians", "international jobs", "Jobs in India"],
})

export default function AbroadJobsLayout({ children }: { children: React.ReactNode }) {
  return children
}
