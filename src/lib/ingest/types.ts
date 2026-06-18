/**
 * Ingestion framework types. Each government source is a pluggable
 * SourceAdapter; new sources are added by dropping a file in ./adapters and
 * registering it in ./registry — no engine changes required.
 */
import type { GovtJobTab } from "@/types/govtJob"

/** A raw notification parsed from a source, before normalisation/enrichment. */
export interface RawNotification {
  /** Stable external key (notification number / source URL slug) — used for dedupe. */
  externalId: string
  title: string
  org?: string
  post?: string
  vacancies?: string
  qualification?: string
  lastDate?: string
  startDate?: string
  fee?: string
  salary?: string
  location?: string
  state?: string
  /** Canonical state slug (e.g. "karnataka"). When set, it is authoritative —
   * the engine won't re-derive it from the state name. Used by state-PSC
   * adapters so coverage lands in the correct state deterministically. */
  stateSlug?: string
  tab?: GovtJobTab
  officialUrl?: string
  notificationPdf?: string
}

export type AdapterKind = "rss" | "html" | "pdf" | "json_api" | "spa_blocked" | "manual"

export interface SourceAdapter {
  /** Stable id, also written as govt_jobs.source_id provenance. */
  id: string
  label: string
  kind: AdapterKind
  /** Only enabled adapters are polled. Stubs ship disabled until implemented. */
  enabled: boolean
  /** Fetch + parse into raw notifications. Unimplemented adapters return []. */
  fetch(): Promise<RawNotification[]>
}
