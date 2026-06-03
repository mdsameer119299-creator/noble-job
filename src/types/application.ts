export type ApplicationStatus = 'new' | 'shortlisted' | 'interview' | 'hired' | 'rejected'
export interface Application {
  id: string; job_id: string; candidate_id: string; employer_id: string | null
  status: ApplicationStatus; applied_at: string; notes?: string; board: string
  job?: { title: string; company: string; location: string }
  candidate?: { first_name: string; last_name: string; skills: string[]; has_resume?: boolean }
}
