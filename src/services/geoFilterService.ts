import { isIndiaEligible } from "@/lib/utils/geoFilter"

export function filterForIndia<T extends { locationRestrictions?: string[] }>(jobs: T[]): T[] {
  return jobs.filter(j => isIndiaEligible(j.locationRestrictions))
}
