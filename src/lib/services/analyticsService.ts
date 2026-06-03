import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { AnalyticsSummary } from "@/types/analytics"

const EMPTY_ANALYTICS: AnalyticsSummary = {
  performanceTrend: [],
  sources: [],
  categories: [],
  funnel: [
    { label: "Applied", value: 0 },
    { label: "Shortlisted", value: 0 },
    { label: "Interview", value: 0 },
    { label: "Hired", value: 0 },
  ],
  timeToHireDays: 14,
  conversionRate: 0,
  avgApplicationsPerJob: 0,
}

export async function getEmployerAnalytics(employerId: string): Promise<AnalyticsSummary> {
  if (!isSupabaseConfigured()) return EMPTY_ANALYTICS
  const sb = await createClient()
  if (!sb) return EMPTY_ANALYTICS

  const { data: apps } = await sb
    .from("applications")
    .select("status, applied_at")
    .eq("employer_id", employerId)
  const appList = apps || []
  const statusCounts = appList.reduce((acc: Record<string, number>, a: { status?: string }) => {
    if (a.status) acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {})

  const trend: AnalyticsSummary["performanceTrend"] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const count = appList.filter((a: { applied_at?: string }) => {
      if (!a.applied_at) return false
      const ad = new Date(a.applied_at)
      return ad.toDateString() === d.toDateString()
    }).length
    trend.push({ date: d.toISOString().slice(0, 10), applications: count })
  }

  return {
    performanceTrend: trend,
    sources: [{ label: "Noble Job", value: appList.length }, { label: "Direct", value: 0 }],
    categories: [],
    funnel: [
      { label: "Applied", value: appList.length },
      { label: "Shortlisted", value: statusCounts.shortlisted || 0 },
      { label: "Interview", value: statusCounts.interview || 0 },
      { label: "Hired", value: statusCounts.hired || 0 },
    ],
    timeToHireDays: 14,
    conversionRate: appList.length
      ? Math.round(((statusCounts.hired || 0) / appList.length) * 100)
      : 0,
    avgApplicationsPerJob: 0,
  }
}
