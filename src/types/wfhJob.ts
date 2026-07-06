import type { JobStatus, Provenance } from './job'

export interface WfhJob {
  id: string; title: string; company: string; logo: string; color: string
  type: string; experience: string; salary: string; cat: string
  qualification: string; skills: string[]; badge: string; badge_type: string
  applicants: number; description: string; apply_url: string
  posted_at: string; status: 'active' | 'closed'; jobStatus?: JobStatus
  /** Real sourced opportunity vs generated demo content. See provenance.ts. */
  provenance?: Provenance
}
