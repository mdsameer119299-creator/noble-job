import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getInventoryCounts } from "@/lib/data/jobInventory"
import { JOB_STRATEGY_PHASE } from "@/lib/config/jobStrategy"
import type { AdminStats } from "@/types/admin"

/** Fallback analytics from the in-memory inventory when no DB is connected. */
function fallbackStats(): AdminStats {
  const c = getInventoryCounts()
  return {
    totalJobs: c.live + c.verified, pendingJobs: 0,
    totalEmployers: JOB_STRATEGY_PHASE.targets.verifiedEmployers,
    totalCandidates: 0, totalApplications: 0, totalMessages: 0,
    liveJobs: c.live, verifiedJobs: c.verified, archivedJobs: c.archived,
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  if (!isSupabaseConfigured()) return fallbackStats()
  try {
    const [jobs, employers, candidates, apps, msgs, live, verified, archived] = await Promise.all([
      supabaseAdmin.from("jobs").select("id", { count: "exact" }).eq("status", "active"),
      supabaseAdmin.from("employers").select("id", { count: "exact" }),
      supabaseAdmin.from("candidates").select("id", { count: "exact" }),
      supabaseAdmin.from("applications").select("id", { count: "exact" }),
      supabaseAdmin.from("contact_messages").select("id", { count: "exact" }).eq("status", "unread"),
      supabaseAdmin.from("jobs").select("id", { count: "exact" }).eq("job_status", "LIVE_JOB"),
      supabaseAdmin.from("jobs").select("id", { count: "exact" }).eq("job_status", "VERIFIED_JOB"),
      supabaseAdmin.from("jobs").select("id", { count: "exact" }).eq("job_status", "ARCHIVED_JOB"),
    ])
    const pending = await supabaseAdmin.from("jobs").select("id", { count: "exact" }).eq("status", "pending")
    return {
      totalJobs: jobs.count || 0, pendingJobs: pending.count || 0,
      totalEmployers: employers.count || 0, totalCandidates: candidates.count || 0,
      totalApplications: apps.count || 0, totalMessages: msgs.count || 0,
      liveJobs: live.count || 0, verifiedJobs: verified.count || 0, archivedJobs: archived.count || 0,
    }
  } catch {
    return fallbackStats()
  }
}

/** Change a job's hybrid status from the admin dashboard. */
export async function setJobStatus(id: string, jobStatus: "LIVE_JOB" | "VERIFIED_JOB" | "ARCHIVED_JOB") {
  return supabaseAdmin.from("jobs").update({ job_status: jobStatus }).eq("id", id)
}

export async function approveJob(id: string) {
  return supabaseAdmin.from("jobs").update({ status: "active" }).eq("id", id)
}

export async function rejectJob(id: string) {
  return supabaseAdmin.from("jobs").update({ status: "rejected" }).eq("id", id)
}

export async function toggleEmployerStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === "active" ? "suspended" : "active"
  const result = await supabaseAdmin.from("employers").update({ status: newStatus }).eq("id", id)

  if (newStatus === "active") {
    const { data: row } = await supabaseAdmin
      .from("employers")
      .select("company_name, users(email)")
      .eq("id", id)
      .single()
    const email = (row as { users?: { email?: string } } | null)?.users?.email
    if (email) {
      const { sendEmployerApprovalEmail } = await import("@/lib/services/emailService")
      await sendEmployerApprovalEmail(
        email,
        (row as { company_name?: string })?.company_name
      )
    }
  }

  return result
}

export async function toggleCandidateStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === "active" ? "suspended" : "active"
  return supabaseAdmin.from("users").update({ status: newStatus }).eq("id", id)
}
