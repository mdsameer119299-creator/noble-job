import type { JobStatus, Provenance } from './job'

export interface WfhJob {
  id: string; title: string; company: string; logo: string; color: string
  type: string; experience: string; salary: string; cat: string
  qualification: string; skills: string[]; badge: string; badge_type: string
  applicants: number; description: string; apply_url: string
  posted_at: string; status: 'active' | 'closed'; jobStatus?: JobStatus
  /** Real sourced opportunity vs generated demo content. See provenance.ts. */
  provenance?: Provenance
  /** Owning employer id — evidence for EMPLOYER provenance genuineness checks. */
  employer_id?: string | null
  is_featured?: boolean
  /**
   * The country a fully-remote role is open to (ISO alpha-2 or name), when the
   * record states one. There is no database column yet, so today it is only ever
   * set by a source that carries it; it is NEVER defaulted. Without it (or an
   * explicit statement in the record's own text) a remote WFH row emits no JobPosting.
   */
  applicant_country?: string | null
  /** ORIGINAL employer/source publication date — the only source of JobPosting `datePosted`. */
  source_posted_at?: string | null
}
