/**
 * types/job.ts — Job-related TypeScript interfaces
 *
 * Shared types for Private Jobs, WFH Jobs, Live Jobs engine.
 * Matches the shape of the INDIA_BIG_COMPANY_JOBS array and Himalayas API response.
 */

/**
 * Hybrid job inventory status.
 *  - LIVE_JOB:     real, currently-active opening (API / employer / DB). Green badge.
 *  - VERIFIED_JOB: manually verified opening. Blue badge.
 *  - ARCHIVED_JOB: demo/reference vacancy used to populate the portal. Gray badge,
 *                  shown as "Position Filled"/"Archived Vacancy", never as an open role.
 */
export type JobStatus = "LIVE_JOB" | "VERIFIED_JOB" | "ARCHIVED_JOB"

/**
 * Provenance is ORTHOGONAL to `jobStatus`: it records whether a row is a real
 * sourced opportunity or generated demo/showcase content. See
 * `src/lib/jobs/provenance.ts` for the classifier + publication gate.
 */
import type { Provenance } from "@/lib/jobs/provenance"
export type { Provenance }

/** Sort priority: live first, verified second, archived last. */
export const JOB_STATUS_PRIORITY: Record<JobStatus, number> = {
  LIVE_JOB: 0,
  VERIFIED_JOB: 1,
  ARCHIVED_JOB: 2,
}

export interface Job {
  id:          string
  title:       string
  company:     string
  logo:        string
  logoUrl?:    string | null
  color:       string
  location:    string
  type:        string
  exp:         string
  salary:      string
  cat:         string
  skills:      string[]
  badge?:      string
  jobStatus?:  JobStatus
  /** Real sourced opportunity vs generated demo content. See provenance.ts. */
  provenance?: Provenance
  applyUrl:    string
  desc:        string
  posted:      string
  verified:    boolean
  source:      string
  board:       "private" | "wfh" | "abroad" | "govt"
  /** Legacy / Supabase field aliases */
  job_type?:   string
  category?:   string
  description?: string
  apply_url?:  string
}

export interface JobFilter {
  q?:          string
  location?:   string
  salary?:     string
  exp?:        string
  type?:       string
  category?:   string
  status?:     JobStatus | "all"
  page?:       number
  limit?:      number
  sort?:       "latest" | "salary_high" | "applicants"
}

export interface JobSearchResult {
  jobs:        Job[]
  total:       number
  page:        number
  totalPages:  number
  /** Counts by status across the full (unpaginated) filtered set. */
  counts?:     { all: number; live: number; verified: number; archived: number }
}
