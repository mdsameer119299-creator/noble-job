import { JsonLd } from "@/components/seo/JsonLd"
import { buildWfhJobPosting } from "@/lib/seo/jobPostingBuilders"
import type { WfhJob } from "@/types/wfhJob"
import type { JobContent } from "@/lib/seo/jobContent"

export function WfhJobJsonLd({ job, content }: { job: WfhJob; content: JobContent }) {
  const posting = buildWfhJobPosting(job, content)
  return posting ? <JsonLd data={posting} /> : null
}
