import { isSupabaseConfigured } from "@/lib/supabase/config"

export type JobViewBoard = "private" | "wfh" | "abroad"

/**
 * Best-effort, fire-and-forget view counter — never awaited by a detail page,
 * so a slow/failed write can't delay or break rendering. Uses the
 * `increment_job_views` Postgres function (see migration
 * 20260726000001_job_views_count.sql) for an atomic increment rather than a
 * read-then-write from the client, which would race under concurrent views.
 */
export async function incrementJobViews(board: JobViewBoard, id: string): Promise<void> {
  if (!isSupabaseConfigured() || !id) return
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    await supabaseAdmin.rpc("increment_job_views", { p_board: board, p_id: id })
  } catch {
    // Non-critical metric — swallow so a DB hiccup never surfaces to a viewer.
  }
}
