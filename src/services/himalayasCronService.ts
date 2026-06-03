// himalayasCronService — scheduled job to refresh Himalayas cache
// Runs every hour via Vercel Cron (vercel.json crons config)
// or triggered by ISR revalidation on /api/external/jobs

import { fetchHimalayasJobs } from "@/lib/services/himalayasService"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function refreshHimalayasCache(): Promise<number> {
  const jobs = await fetchHimalayasJobs()
  let count = 0
  for (const job of jobs) {
    const { error } = await supabaseAdmin.from("himalayas_jobs_cache").upsert({
      external_id:  job.id,
      title:        job.title,
      company:      job.company,
      logo_url:     job.logoUrl,
      location:     job.location,
      salary_text:  job.salary,
      category:     job.cat,
      seniority:    job.exp,
      apply_url:    job.applyUrl,
      source_data_json: job as unknown as import("@/types/supabase").Json,
      fetched_at:   new Date().toISOString(),
      expires_at:   new Date(Date.now() + 3_600_000).toISOString(),
    }, { onConflict: "external_id" })
    if (!error) count++
  }
  return count
}
