import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { HUB_DESCRIPTIONS } from "@/lib/seo/hubDescriptions"

export const metadata: Metadata = buildPageMetadata({
  title: "Work From Home Jobs in India — Remote & WFH | Noble Job",
  description:
    HUB_DESCRIPTIONS.wfh,
  path: "/jobs/wfh",
  keywords: ["Work From Home Jobs", "WFH Jobs", "remote jobs India", "Jobs in India"],
})

export default function WfhJobsLayout({ children }: { children: React.ReactNode }) {
  return children
}
