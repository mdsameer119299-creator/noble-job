import type { JobStatus, Provenance } from './job'

export interface AbroadJob {
  id: string; title: string; company: string; logo: string; country: string
  location: string; type: string; salary: string; experience: string
  category: string; description: string; apply_url: string
  skills: string[]; badge?: string; status: 'active' | 'closed'; posted_at: string
  jobStatus?: JobStatus
  /** Real sourced opportunity vs generated demo content. See provenance.ts. */
  provenance?: Provenance
}
