import { isScam, isTrustedCompany } from "@/lib/utils/scamFilter"
import type { ScamCheckInput } from "@/lib/utils/scamFilter"

export function filterJobs<T extends ScamCheckInput>(jobs: T[]): T[] {
  return jobs.filter(job => {
    if (isTrustedCompany(job.company)) return true
    return !isScam(job)
  })
}
