import { isSupabaseConfigured } from "@/lib/supabase/config"
import { isGenuine } from "@/lib/jobs/provenance"
import { getPrivateJobsFeaturedLocal } from "@/lib/services/jobLocal"
import type { Job } from "@/types/job"

/**
 * "Featured" is a stronger trust claim than a plain listing badge, so it is
 * genuine-only regardless of the synthetic-visibility admin toggle — unlike
 * every other public surface, this one never shows demo content, full stop.
 */
export async function getFeaturedPrivateJobs(limit = 4): Promise<Job[]> {
  const localGenuineFeatured = () => getPrivateJobsFeaturedLocal(200, true).filter(isGenuine).slice(0, limit)

  if (!isSupabaseConfigured()) return localGenuineFeatured()

  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return localGenuineFeatured()

    const { data: featuredRows } = await sb
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .eq("is_featured", true)
      .order("posted_at", { ascending: false })
      .limit(20)
    const featured = ((featuredRows || []) as unknown as Job[]).filter(isGenuine).slice(0, limit)
    if (featured.length) return featured

    // No rows explicitly marked featured yet — fall back to the latest
    // genuine active jobs rather than showing nothing.
    const { data: latestRows } = await sb
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .order("posted_at", { ascending: false })
      .limit(20)
    const latestGenuine = ((latestRows || []) as unknown as Job[]).filter(isGenuine).slice(0, limit)
    return latestGenuine.length ? latestGenuine : localGenuineFeatured()
  } catch {
    return localGenuineFeatured()
  }
}
