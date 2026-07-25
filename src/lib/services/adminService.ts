import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getInventoryCounts } from "@/lib/data/jobInventory"
import { notifyUser } from "@/lib/services/adminNotifyService"
import { JOB_BOARD_TABLE, type EmployerJobBoard } from "@/lib/services/jobLifecycle"
import type { AdminStats } from "@/types/admin"

function fallbackStats(): AdminStats {
  const c = getInventoryCounts()
  return {
    totalJobs: c.live + c.verified + c.archived,
    pendingJobs: 0,
    totalEmployers: 0,
    totalCandidates: 0,
    totalApplications: 0,
    totalMessages: 0,
    liveJobs: c.live,
    verifiedJobs: c.verified,
    archivedJobs: c.archived,
  }
}

async function getHybridJobCounts(): Promise<{ live: number; verified: number; archived: number }> {
  const [live, verified, archived] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("job_status", "LIVE_JOB"),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("job_status", "VERIFIED_JOB"),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("job_status", "ARCHIVED_JOB"),
  ])

  if (!live.error && !verified.error && !archived.error) {
    return { live: live.count || 0, verified: verified.count || 0, archived: archived.count || 0 }
  }

  const [verifiedCount, unverifiedCount] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_verified", true),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_verified", false),
  ])
  return { live: unverifiedCount.count || 0, verified: verifiedCount.count || 0, archived: 0 }
}

export async function getAdminStats(): Promise<AdminStats> {
  if (!isSupabaseConfigured()) return fallbackStats()
  try {
    const [employers, candidates, apps, msgs, pending, hybrid] = await Promise.all([
      supabaseAdmin.from("employers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("candidates").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "unread"),
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
      getHybridJobCounts(),
    ])

    return {
      totalJobs: hybrid.live + hybrid.verified + hybrid.archived,
      pendingJobs: pending.count || 0,
      totalEmployers: employers.count || 0,
      totalCandidates: candidates.count || 0,
      totalApplications: apps.count || 0,
      totalMessages: msgs.count || 0,
      liveJobs: hybrid.live,
      verifiedJobs: hybrid.verified,
      archivedJobs: hybrid.archived,
    }
  } catch {
    return fallbackStats()
  }
}

export async function setJobStatus(id: string, jobStatus: "LIVE_JOB" | "VERIFIED_JOB" | "ARCHIVED_JOB") {
  return supabaseAdmin.from("jobs").update({ job_status: jobStatus }).eq("id", id)
}

async function notifyJobDecision(board: EmployerJobBoard, jobId: string, approved: boolean) {
  try {
    const table = JOB_BOARD_TABLE[board]
    const { data: job } = await supabaseAdmin.from(table).select("title, employer_id").eq("id", jobId).single()
    const employerId = (job as { employer_id?: string | null })?.employer_id
    const title = (job as { title?: string })?.title || "your job"
    if (!employerId) return
    const { data: emp } = await supabaseAdmin.from("employers").select("user_id, users(email)").eq("id", employerId).single()
    const userId = (emp as { user_id?: string } | null)?.user_id
    const email = (emp as { users?: { email?: string } } | null)?.users?.email
    if (userId) await notifyUser(userId, approved ? "job_approved" : "job_rejected", approved ? "Job approved" : "Job not approved", approved ? `"${title}" is now live on Noble Job.` : `"${title}" was not approved.`)
    if (email) {
      const { sendJobDecisionEmail } = await import("./emailService")
      await sendJobDecisionEmail(email, title, approved)
    }
  } catch (e) {
    console.warn("[job-decision] notify failed:", e instanceof Error ? e.message : e)
  }
}

export async function approveJob(id: string, board: EmployerJobBoard = "private") {
  const table = JOB_BOARD_TABLE[board]
  const result = await supabaseAdmin.from(table).update({ status: "active" }).eq("id", id)
  // Never notify (in-app + email) after a failed DB mutation.
  if (result.error) return result
  await notifyJobDecision(board, id, true)
  const { notifyAdmins } = await import("@/lib/services/adminNotifyService")
  await notifyAdmins("job_approved", "Job approved", "A job posting was approved and is now live.")
  return result
}

export async function rejectJob(id: string, board: EmployerJobBoard = "private") {
  const table = JOB_BOARD_TABLE[board]
  const result = await supabaseAdmin.from(table).update({ status: "rejected" }).eq("id", id)
  // Never notify after a failed DB mutation.
  if (result.error) return result
  // Keep dashboard counts consistent: Live/Verified/Total read `job_status`, so a
  // rejected job must leave those buckets. Best-effort + resilient — a missing
  // job_status column (environments without that migration, or a board that has
  // no job_status column at all — only `jobs` does) must not fail the rejection
  // itself, which already succeeded above.
  if (board === "private") {
    const archived = await supabaseAdmin.from("jobs").update({ job_status: "ARCHIVED_JOB" }).eq("id", id)
    if (archived.error) console.warn("[reject-job] job_status archive skipped:", archived.error.message)
  }
  await notifyJobDecision(board, id, false)
  const { notifyAdmins } = await import("@/lib/services/adminNotifyService")
  await notifyAdmins("job_rejected", "Job rejected", "A job posting was rejected.")
  return result
}

export async function verifyEmployer(id: string) {
  const result = await supabaseAdmin.from("employers").update({ verified: true, status: "active" }).eq("id", id)
  try {
    const { data: row } = await supabaseAdmin.from("employers").select("company_name, user_id, users(email)").eq("id", id).single()
    const userId = (row as { user_id?: string } | null)?.user_id
    const email = (row as { users?: { email?: string } } | null)?.users?.email
    const company = (row as { company_name?: string } | null)?.company_name
    if (userId) await notifyUser(userId, "employer_verified", "Account verified", "Your employer account has been verified by Noble Job.")
    if (email) {
      const { sendEmployerApprovalEmail } = await import("@/lib/services/emailService")
      await sendEmployerApprovalEmail(email, company)
    }
  } catch (e) {
    console.warn("[verify-employer] notify failed:", e instanceof Error ? e.message : e)
  }
  return result
}

export async function toggleEmployerStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === "active" ? "suspended" : "active"
  const result = await supabaseAdmin.from("employers").update({ status: newStatus }).eq("id", id)
  try {
    const { data: row } = await supabaseAdmin.from("employers").select("company_name, user_id, users(email)").eq("id", id).single()
    const email = (row as { users?: { email?: string } } | null)?.users?.email
    const userId = (row as { user_id?: string } | null)?.user_id
    const company = (row as { company_name?: string } | null)?.company_name
    if (newStatus === "active") {
      if (userId) await notifyUser(userId, "employer_approved", "Account active", "Your employer account is active. You can post jobs and manage applications.")
      if (email) {
        const { sendEmployerApprovalEmail } = await import("@/lib/services/emailService")
        await sendEmployerApprovalEmail(email, company)
      }
    } else {
      if (userId) await notifyUser(userId, "employer_suspended", "Account suspended", "Your employer account has been suspended. Contact support for details.")
      if (email) {
        const { sendEmployerSuspendedEmail } = await import("@/lib/services/emailService")
        await sendEmployerSuspendedEmail(email, company)
      }
    }
  } catch (e) {
    console.warn("[employer-status] notify failed:", e instanceof Error ? e.message : e)
  }
  return result
}

export async function toggleCandidateStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === "active" ? "suspended" : "active"
  return supabaseAdmin.from("users").update({ status: newStatus }).eq("id", id)
}
