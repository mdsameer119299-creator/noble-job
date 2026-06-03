import type { JobStatus } from './job'

export interface AbroadJob {
  id: string; title: string; company: string; logo: string; country: string
  location: string; type: string; salary: string; experience: string
  category: string; description: string; apply_url: string
  skills: string[]; badge?: string; status: 'active' | 'closed'; posted_at: string
  jobStatus?: JobStatus
}
