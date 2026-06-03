import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export type TrendPoint = { label: string; applications: number; jobs: number }

/** Last 7 days application + job counts for admin trend chart. */
export async function getAdminTrendData(): Promise<TrendPoint[]> {
  if (!isSupabaseConfigured()) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map((label, i) => ({ label, applications: 12 + i * 3, jobs: 4 + i }))
  }

  const points: TrendPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    const label = start.toLocaleDateString('en-IN', { weekday: 'short' })

    const [apps, jobs] = await Promise.all([
      supabaseAdmin
        .from("applications")
        .select("id", { count: "exact" })
        .gte("applied_at", start.toISOString())
        .lte("applied_at", end.toISOString()),
      supabaseAdmin
        .from("jobs")
        .select("id", { count: "exact" })
        .gte("posted_at", start.toISOString())
        .lte("posted_at", end.toISOString()),
    ])

    points.push({
      label,
      applications: apps.count || 0,
      jobs: jobs.count || 0,
    })
  }
  return points
}
