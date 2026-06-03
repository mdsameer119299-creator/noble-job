/**
 * types/employer.ts — Employer-related types
 *
 * All 11 employer dashboard section data shapes.
 * Matches the ADB.employers seed data + all employer API responses.
 */

export interface Employer {
  id:           string
  userId:       string
  companyName:  string
  website?:     string
  city:         string
  industry:     string
  companySize:  string
  designation:  string
  logoUrl?:     string
  status:       "active" | "suspended"
  planType:     "free" | "starter" | "professional" | "enterprise"
  isVerified:   boolean
  createdAt:    string
}

export interface EmployerStats {
  activeJobs:     number
  applications:   number
  shortlisted:    number
  interviews:     number
  hired:          number
}

export interface AnalyticsData {
  performanceTrend:  { date: string; applications: number }[]
  sources:           { source: string; count: number }[]
  categories:        { category: string; count: number }[]
  funnel:            { stage: string; count: number }[]
  timeToHire:        number   // days average
}
