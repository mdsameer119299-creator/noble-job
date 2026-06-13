/**
 * Adapter registry — the single source of truth for ingestion sources.
 * The engine (govtAutoUpdate) iterates the enabled adapters here.
 */
import type { SourceAdapter } from "./types"
import { ALL_ADAPTERS } from "./adapters"

export const ADAPTERS: SourceAdapter[] = ALL_ADAPTERS

const BY_ID = new Map(ADAPTERS.map(a => [a.id, a]))

export function getAdapter(id: string): SourceAdapter | undefined {
  return BY_ID.get(id)
}

export function enabledAdapters(): SourceAdapter[] {
  return ADAPTERS.filter(a => a.enabled)
}
