// Detail pages resolve database rows only when the site serves the database — a card that
// links to a page that would 404 is an empty job, so the same switch gates every list here.
import { useLocalInventoryOnly } from "@/lib/supabase/useLocalInventory"
import { filterActionable, filterListable, displayValue } from "@/lib/jobs/renderable"
import { getPrivateJobsFeaturedLocal } from "@/lib/services/jobLocal"
import { getLivePrivateJobs, getLiveWfhJobs, getLiveAbroadJobs } from "@/lib/services/liveJobOpportunities"
import { mapPrivateJobRow } from "@/lib/services/jobMapper"
import type { Job } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"

export type FeaturedBoard = "private" | "wfh" | "abroad"

export interface FeaturedJobCard {
  board: FeaturedBoard
  id: string
  title: string
  company: string
  location: string
  salary?: string
  color?: string
}

const privateActionable = (rows: unknown[]): Job[] =>
  filterActionable(rows.map(r => mapPrivateJobRow(r as Record<string, unknown>)), "private")

// Looser than `privateActionable`: genuine + open, WITHOUT requiring an apply
// route — used only by `getLatestJobCards`, which may honestly show a genuine
// sourced/curated listing (informational, no on-site Apply) next to a genuine
// employer-owned opening. See `isListableJob` in renderable.ts.
const privateListable = (rows: unknown[]): Job[] =>
  filterListable(rows.map(r => mapPrivateJobRow(r as Record<string, unknown>)), "private")

/** Merge a live external pool with a DB pool, DB jobs first dedupe-skipped against live ids. */
function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  return [...primary, ...secondary.filter(s => !primary.some(p => p.id === s.id))]
}

export async function getFeaturedPrivateJobs(limit = 4): Promise<Job[]> {
  const localGenuineFeatured = () => filterActionable(getPrivateJobsFeaturedLocal(200, true), "private").slice(0, limit)

  if (useLocalInventoryOnly()) {
    const live = await getLivePrivateJobs()
    return live.slice(0, limit)
  }

  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return (await getLivePrivateJobs()).slice(0, limit)

    const { data: featuredRows } = await sb
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .eq("is_featured", true)
      .order("posted_at", { ascending: false })
      .limit(20)
    const featured = privateActionable(featuredRows || []).slice(0, limit)
    if (featured.length) return featured

    const { data: latestRows } = await sb
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .order("posted_at", { ascending: false })
      .limit(20)
    const latestGenuine = privateActionable(latestRows || []).slice(0, limit)
    if (latestGenuine.length) return latestGenuine

    const live = await getLivePrivateJobs()
    return live.length ? live.slice(0, limit) : localGenuineFeatured()
  } catch {
    const live = await getLivePrivateJobs()
    return live.length ? live.slice(0, limit) : localGenuineFeatured()
  }
}

async function getFeaturedWfhJobs(limit = 4): Promise<WfhJob[]> {
  const live = await getLiveWfhJobs()
  if (live.length) return live.slice(0, limit)
  if (useLocalInventoryOnly()) return []
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return []
    const { data } = await sb
      .from("wfh_jobs")
      .select("*")
      .eq("status", "active")
      .order("posted_at", { ascending: false })
      .limit(20)
    return filterActionable((data || []) as unknown as WfhJob[], "wfh").slice(0, limit)
  } catch {
    return []
  }
}

async function getFeaturedAbroadJobs(limit = 4): Promise<AbroadJob[]> {
  const live = await getLiveAbroadJobs()
  if (live.length) return live.slice(0, limit)
  if (useLocalInventoryOnly()) return []
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return []
    const { data } = await sb
      .from("abroad_jobs")
      .select("*")
      .eq("status", "active")
      .order("posted_at", { ascending: false })
      .limit(20)
    return filterActionable((data || []) as unknown as AbroadJob[], "abroad").slice(0, limit)
  } catch {
    return []
  }
}

export async function getFeaturedJobsMix(total = 6): Promise<FeaturedJobCard[]> {
  const perBoard = Math.max(2, Math.ceil(total / 3))
  const [privateJobs, wfhJobs, abroadJobs] = await Promise.all([
    getFeaturedPrivateJobs(perBoard),
    getFeaturedWfhJobs(perBoard),
    getFeaturedAbroadJobs(perBoard),
  ])

  const privateCards: FeaturedJobCard[] = privateJobs.map(j => ({
    board: "private", id: j.id, title: j.title, company: j.company, location: j.location, salary: displayValue(j.salary), color: j.color,
  }))
  const wfhCards: FeaturedJobCard[] = wfhJobs.map(j => ({
    board: "wfh", id: j.id, title: j.title, company: j.company, location: "Remote", salary: displayValue(j.salary), color: j.color,
  }))
  const abroadCards: FeaturedJobCard[] = abroadJobs.map(j => ({
    board: "abroad", id: j.id, title: j.title, company: j.company, location: displayValue(j.location) || j.country, salary: displayValue(j.salary), color: "#7c3aed",
  }))

  const lists = [privateCards, wfhCards, abroadCards]
  const mixed: FeaturedJobCard[] = []
  for (let i = 0; mixed.length < total && lists.some(l => l.length > i); i++) {
    for (const l of lists) {
      if (l[i]) mixed.push(l[i])
      if (mixed.length >= total) break
    }
  }
  return mixed
}

/**
 * Newest LISTABLE jobs of one board for the homepage "Latest Job Openings" grid —
 * genuine employer-owned openings AND genuine sourced/informational listings alike
 * (see `isListableJob`). Never synthetic/unclassified/demo content.
 *
 * Live (third-party aggregator) results and database results are MERGED, not
 * either/or: a prior version of this function returned early with only the live
 * pool whenever it was non-empty, which meant genuine database jobs (the 7 real
 * Private openings, for example) never reached the homepage at all as soon as a
 * single live external job existed. Deduped by id, live first.
 */
export async function getLatestJobCards(board: FeaturedBoard, limit = 4): Promise<FeaturedJobCard[]> {
  if (board === "private") {
    const live = await getLivePrivateJobs()
    const liveCards = live.map(j => ({
      board, id: j.id, title: j.title, company: j.company, location: j.location, salary: displayValue(j.salary), color: j.color,
    }))
    if (useLocalInventoryOnly()) return liveCards.slice(0, limit)
    const dbCards = await getLatestPrivateDbCards(limit + live.length)
    return mergeById(liveCards, dbCards).slice(0, limit)
  }

  if (board === "wfh") {
    const live = await getLiveWfhJobs()
    const liveCards = live.map(j => ({
      board, id: j.id, title: j.title, company: j.company, location: "Remote", salary: displayValue(j.salary), color: j.color,
    }))
    if (useLocalInventoryOnly()) return liveCards.slice(0, limit)
    const dbCards = await getLatestBoardDbCards("wfh", limit + live.length)
    return mergeById(liveCards, dbCards).slice(0, limit)
  }

  // board === "abroad"
  const live = await getLiveAbroadJobs()
  const liveCards = live.map(j => ({
    board, id: j.id, title: j.title, company: j.company, location: displayValue(j.location) || j.country, salary: displayValue(j.salary), color: "#7c3aed",
  }))
  if (useLocalInventoryOnly()) return liveCards.slice(0, limit)
  const dbCards = await getLatestBoardDbCards("abroad", limit + live.length)
  return mergeById(liveCards, dbCards).slice(0, limit)
}

async function getLatestPrivateDbCards(limit: number): Promise<FeaturedJobCard[]> {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return []
    const { data } = await sb
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .order("posted_at", { ascending: false })
      .limit(40)
    const rows = (data || []) as unknown[]
    return privateListable(rows).slice(0, limit).map(j => ({
      board: "private" as const, id: j.id, title: j.title, company: j.company, location: j.location, salary: displayValue(j.salary), color: j.color,
    }))
  } catch {
    return []
  }
}

async function getLatestBoardDbCards(board: "wfh" | "abroad", limit: number): Promise<FeaturedJobCard[]> {
  const table = board === "wfh" ? "wfh_jobs" : "abroad_jobs"
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return []
    const { data } = await sb
      .from(table)
      .select("*")
      .eq("status", "active")
      .order("posted_at", { ascending: false })
      .limit(40)
    const rows = (data || []) as unknown[]
    if (board === "wfh") {
      return filterListable(rows as unknown as WfhJob[], "wfh").slice(0, limit).map(j => ({
        board: "wfh" as const, id: j.id, title: j.title, company: j.company, location: "Remote", salary: displayValue(j.salary), color: j.color,
      }))
    }
    return filterListable(rows as unknown as AbroadJob[], "abroad").slice(0, limit).map(j => ({
      board: "abroad" as const, id: j.id, title: j.title, company: j.company, location: displayValue(j.location) || j.country, color: "#7c3aed",
    }))
  } catch {
    return []
  }
}
