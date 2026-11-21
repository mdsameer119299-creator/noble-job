import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { HUB_DESCRIPTIONS } from "@/lib/seo/hubDescriptions"

export const metadata: Metadata = buildPageMetadata({
  title: "Abroad Jobs for Indians — International Careers | Noble Job",
  description:
    HUB_DESCRIPTIONS.abroad,
  path: "/jobs/abroad",
  keywords: ["Abroad Jobs", "jobs abroad for Indians", "international jobs", "Jobs in India"],
})

export default function AbroadJobsLayout({ children }: { children: React.ReactNode }) {
  return children
}
