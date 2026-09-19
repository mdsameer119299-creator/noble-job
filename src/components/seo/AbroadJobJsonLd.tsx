import { JsonLd } from "@/components/seo/JsonLd"
import { buildAbroadJobPosting } from "@/lib/seo/jobPostingBuilders"
import type { AbroadJob } from "@/types/abroadJob"
import type { JobContent } from "@/lib/seo/jobContent"

export function AbroadJobJsonLd({ job, content }: { job: AbroadJob; content: JobContent }) {
  const posting = buildAbroadJobPosting(job, content)
  return posting ? <JsonLd data={posting} /> : null
}
