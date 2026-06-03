// Job alert email dispatcher — triggered by cron or on new job post
// Queries job_alerts table and sends matching job summaries via Resend
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/services/emailService"

export async function dispatchJobAlerts(jobId: string): Promise<void> {
  const { data: job } = await supabaseAdmin.from("jobs").select("*").eq("id", jobId).single()
  if (!job) return

  const { data: alerts } = await supabaseAdmin.from("job_alerts")
    .select("*").eq("is_active", true)
    .or(`board.eq.all,board.eq.${(job as any).board}`)

  for (const alert of (alerts || [])) {
    if ((alert as any).category && (alert as any).category !== (job as any).category) continue
    await sendEmail({
      to: (alert as any).email,
      subject: `New Job Alert: ${(job as any).title} at ${(job as any).company}`,
      html: `<p>A new job matching your alert is available on Noble Job.</p><p><strong>${(job as any).title}</strong><br>${(job as any).location} · ${(job as any).salary_min ? `₹${(job as any).salary_min / 100000}L` : "Competitive"}</p><a href="${process.env.NEXT_PUBLIC_APP_URL}/jobs/private/${(job as any).id}">View Job</a>`,
    })
  }
}
