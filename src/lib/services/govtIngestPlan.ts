/**
 * govtIngestPlan.ts — decide, BEFORE any write, which ingested notifications
 * actually need to be written.
 *
 * Previously every run upserted every row: the `updated_at` trigger bumped on
 * each rewrite (so `updated_at` said nothing about real change), `status` was
 * reset to active, and `content_hash` was stored but never compared. Now:
 *
 *   new row                → insert; content_changed_at = now
 *   existing, hash differs → update; content_changed_at = now
 *   existing, hash same    → NO write at all (content_changed_at stays put)
 *
 * Pure + dependency-free so it is unit-testable.
 */

export interface ExistingGovtRow {
  id: string
  content_hash: string | null
  record_type?: string | null
}

export interface PlanEntry {
  id: string
  hash: string
  /** record_type derived by the ingestion engine for this notification. */
  recordType: string
}

export interface PlannedWrite<E extends PlanEntry> {
  entry: E
  isNew: boolean
  /** Set on new + changed rows only — the moment the public content changed. */
  contentChangedAt: string
  /** Existing record_type wins over the derived one (an editor may have set it). */
  recordType: string
}

export interface IngestPlan<E extends PlanEntry> {
  writes: PlannedWrite<E>[]
  unchanged: E[]
}

export function planIngestWrites<E extends PlanEntry>(
  entries: E[],
  existing: ExistingGovtRow[],
  now: string = new Date().toISOString(),
): IngestPlan<E> {
  const byId = new Map(existing.map(r => [r.id, r]))
  const writes: PlannedWrite<E>[] = []
  const unchanged: E[] = []
  for (const entry of entries) {
    const row = byId.get(entry.id)
    if (row && row.content_hash && row.content_hash === entry.hash) {
      unchanged.push(entry)
      continue
    }
    writes.push({
      entry,
      isNew: !row,
      contentChangedAt: now,
      recordType: row?.record_type || entry.recordType,
    })
  }
  return { writes, unchanged }
}
