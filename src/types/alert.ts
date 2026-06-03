export interface JobAlert {
  id: string; email: string; user_id?: string; keywords?: string
  location?: string; category?: string; job_type?: string
  board: string; frequency: 'daily' | 'weekly'; is_active: boolean; created_at: string
}
