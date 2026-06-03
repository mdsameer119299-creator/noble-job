export interface AdminStats {
  totalJobs: number; pendingJobs: number; totalEmployers: number
  totalCandidates: number; totalApplications: number; totalMessages: number
  liveJobs: number; verifiedJobs: number; archivedJobs: number
}
export interface AdminSetting { key: string; value: string }
export interface SiteContent { key: string; value: string }
