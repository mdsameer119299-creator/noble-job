import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { fetchHimalayasJobs, type HimalayasJob } from "./himalayasService"
import { isUsableLiveJob } from "@/lib/jobs/renderable"

/** NO EMPTY JOBS: only cards with a real id/title/company/apply URL are ever returned. */
const usable = (jobs: HimalayasJob[]): HimalayasJob[] =>
  jobs.filter(j => isUsableLiveJob(j as unknown as Record<string, unknown>))

/** Read non-expired rows from cache; returns [] if DB unavailable or empty. */
export async function getCachedHimalayasJobs(limit = 80): Promise<HimalayasJob[]> {
  if (!isSupabaseConfigured()) return []

  const { data } = await supabaseAdmin
    .from("himalayas_jobs_cache")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("fetched_at", { ascending: false })
    .limit(limit)

  if (!data?.length) return []

  return usable(data.map(row => {
    const raw = row.source_data_json as HimalayasJob | null
    if (raw?.id) return raw
    return {
      id: row.external_id,
      title: row.title,
      company: row.company,
      logoUrl: row.logo_url,
      location: row.location || "Remote",
      type: "Remote",
      exp: row.seniority || "",
      salary: row.salary_text || "",
      cat: row.category || "IT / Software",
      color: "#1847d4",
      applyUrl: row.apply_url || "",
      badge: "Verified" as const,
      source: "Himalayas",
      posted: row.fetched_at,
      verified: true,
    }
  }))
}

/** Cache first; live API fallback. */
export async function getHimalayasJobsForDisplay(limit = 80): Promise<HimalayasJob[]> {
  const cached = await getCachedHimalayasJobs(limit)
  if (cached.length >= 10) return cached.slice(0, limit)
  return fetchHimalayasJobs().then(j => usable(j).slice(0, limit))
}
