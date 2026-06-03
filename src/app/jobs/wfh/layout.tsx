import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = buildPageMetadata({
  title: "Work From Home Jobs in India — Remote & WFH | Noble Job",
  description:
    "Browse Work From Home Jobs and remote openings across India. IT, marketing, customer support, and more — verified WFH jobs on Noble Job.",
  path: "/jobs/wfh",
  keywords: ["Work From Home Jobs", "WFH Jobs", "remote jobs India", "Jobs in India"],
})

export default function WfhJobsLayout({ children }: { children: React.ReactNode }) {
  return children
}
