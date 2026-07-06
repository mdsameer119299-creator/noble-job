import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory, shouldFallbackToLocal } from "@/lib/supabase/useLocalInventory"
import { PRIVATE_INVENTORY } from "@/lib/data/jobInventory"
import { sortByStatus, countByStatus } from "@/lib/data/inventoryPagination"
import { getPrivateJobsLocal, getPrivateJobByIdLocal } from "@/lib/services/jobLocal"
import { classifyProvenance } from "@/lib/jobs/provenance"
import type { Job, JobFilter, JobSearchResult, Provenance } from "@/types/job"

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export async function getJobs(filter: JobFilter = {}): Promise<JobSearchResult> {
  const page = filter.page ?? 1
  const limit = filter.limit ?? 20
  const { q, category, location, exp, type: jType, sort = "latest" } = filter
  const localResult = () => getPrivateJobsLocal(filter)
  if (preferLocalInventory() || !isSupabaseConfigured()) {
    return localResult()
  }

  try {
    const sb = await getSupabaseClient()
    if (!sb) return localResult()

    let query = sb.from("jobs").select("*", { count: "exact" }).eq("status", "active")

    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    if (category && category !== "all") query = query.eq("category", category)
    if (location && location !== "All Locations") query = query.ilike("location", `%${location}%`)
    if (exp) query = query.eq("experience_required", exp)
    if (jType) query = query.eq("job_type", jType)

    if (sort === "latest") query = query.order("posted_at", { ascending: false })
    else if (sort === "salary_high") query = query.order("salary_max", { ascending: false })

    if (filter.status && filter.status !== "all") query = query.eq("job_status", filter.status)

    const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1)
    if (error || !data?.length) {
      return localResult()
    }
    const jobs = (data || []).map(row => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        title: String(r.title),
        company: String(r.company || ""),
        logo: String((r.company as string)?.slice(0, 2) || "NJ"),
        color: "#1847d4",
        location: String(r.location || "India"),
        type: String(r.job_type || "Full Time"),
        exp: String(r.experience_required || ""),
        salary: r.salary_min
          ? `₹${Number(r.salary_min) / 100000}-${Number(r.salary_max) / 100000} LPA`
          : "Competitive",
        cat: String(r.category || ""),
        skills: (r.skills as string[]) || [],
        badge: r.badge as string | undefined,
        jobStatus: (r.job_status as Job["jobStatus"]) || (r.is_verified ? "VERIFIED_JOB" : "LIVE_JOB"),
        // A stored `provenance` wins; otherwise classify defensively so every
        // read is gate-ready. Real DB rows resolve to EMPLOYER/AGGREGATED/CURATED.
        provenance:
          (r.provenance as Provenance) ||
          classifyProvenance({
            id: String(r.id),
            board: "private",
            source: r.source as string | undefined,
            apply_url: r.apply_url as string | undefined,
            employer_id: r.employer_id as string | undefined,
            job_status: r.job_status as string | undefined,
          }),
        applyUrl: String(r.apply_url || "#"),
        desc: String(r.description || ""),
        posted: String(r.posted_at || ""),
        verified: Boolean(r.is_verified),
        source: String(r.source || "Noble Job"),
        board: "private" as const,
      } satisfies Job
    })
    const sorted = sortByStatus(jobs)
    if (shouldFallbackToLocal(sorted.length, PRIVATE_INVENTORY.length)) return localResult()
    return {
      jobs: sorted,
      total: count || jobs.length,
      page,
      totalPages: Math.ceil((count || jobs.length) / limit),
      counts: countByStatus(sorted),
    }
  } catch {
    return localResult()
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  const local = getPrivateJobByIdLocal(id)
  if (preferLocalInventory() || !isSupabaseConfigured()) return local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    const { data } = await sb.from("jobs").select("*").eq("id", id).maybeSingle()
    return (data as unknown as Job) ?? local
  } catch {
    return local
  }
}
