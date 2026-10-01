import { isSupabaseConfigured } from "./config"

/** Production must never fall back to the hand-authored demo inventory. */
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production"
}

/** True only for non-production environments that intentionally use local inventory. */
export function useLocalInventoryOnly(): boolean {
  if (isProductionEnvironment()) return false
  return !isSupabaseConfigured() || preferLocalInventory()
}

/**
 * Job listing source selection.
 * - Default: local seeded inventories (full demo data)
 * - Set `NEXT_PUBLIC_JOB_DATA_SOURCE=supabase` when the remote DB is fully seeded
 */
export function preferLocalInventory(): boolean {
  if (isProductionEnvironment()) return false
  return process.env.NEXT_PUBLIC_JOB_DATA_SOURCE?.trim().toLowerCase() !== "supabase"
}

/** Use local seed when remote has too few rows to be useful. */
export function shouldFallbackToLocal(remoteCount: number, localCount: number): boolean {
  if (isProductionEnvironment()) return false
  if (preferLocalInventory()) return true
  if (!isSupabaseConfigured() || localCount === 0) return remoteCount === 0
  const min = Math.max(15, Math.floor(localCount * 0.2))
  return remoteCount < min
}
