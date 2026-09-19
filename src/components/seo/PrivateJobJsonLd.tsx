import { JsonLd } from "@/components/seo/JsonLd"
import { buildPrivateJobPosting } from "@/lib/seo/jobPostingBuilders"
import type { Job } from "@/types/job"
import type { JobContent } from "@/lib/seo/jobContent"

export function PrivateJobJsonLd({ job, content }: { job: Job; content: JobContent }) {
  // No JobPosting for synthetic/unclassified/closed rows or when a real posting
  // date is missing — see buildPrivateJobPosting.
  const posting = buildPrivateJobPosting(job, content)
  return posting ? <JsonLd data={posting} /> : null
}
