export interface HimalayasApiJob {
  id?: string; slug?: string; title: string; companyName: string
  companyLogo?: string; excerpt?: string; locationRestrictions?: string[]
  employmentType?: string; seniority?: string[]; categories?: string[]
  minSalary?: number; maxSalary?: number; currency?: string
  applicationLink?: string; publishedAt?: string
}
export interface HimalayasApiResponse { jobs: HimalayasApiJob[]; total: number }
