import { isSupabaseConfigured } from "./config"

/** True when listings should use seeded inventories because Supabase is unavailable or local mode is explicitly requested. */
export function useLocalInventoryOnly(): boolean {
  return !isSupabaseConfigured() || preferLocalInventory()
}

/**
 * Job listing source selection.
 * - Production default: Supabase when it is configured.
 * - Local/demo seed: set NEXT_PUBLIC_JOB_DATA_SOURCE=local explicitly.
 *
 * The previous default silently selected the seeded demo inventory whenever the
 * environment variable was missing. That made production candidate pages fall
 * back to sample rows instead of the live database/feed.
 */
export function preferLocalInventory(): boolean {
  return process.env.NEXT_PUBLIC_JOB_DATA_SOURCE?.trim().toLowerCase() === "local"
}

/** Use local seed when remote has too few rows to be useful. */
export function shouldFallbackToLocal(remoteCount: number, localCount: number): boolean {
  if (preferLocalInventory()) return true
  if (!isSupabaseConfigured() || localCount === 0) return remoteCount === 0
  const min = Math.max(15, Math.floor(localCount * 0.2))
  return remoteCount < min
}
