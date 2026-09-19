/**
 * govtPoolResolver.ts — the decision logic for "which govt dataset do we serve
 * right now?", separated from Supabase / Next so it is unit-testable.
 *
 * Order of preference:
 *   1. the live database read                                  → source "db"
 *   2. the last-known-good REAL dataset (age-bounded)          → "last-known-good"
 *   3. the demo seed — ONLY when policy explicitly allows it   → "seed"
 *   4. an honest empty/unavailable state                       → "unavailable"
 *
 * The demo seed is never a silent fallback for a production database failure.
 */

export type GovtPoolSource = "db" | "last-known-good" | "seed" | "unavailable"

export interface GovtPoolSnapshot<T> {
  rows: T[]
  /** epoch ms the snapshot was taken from a successful database read */
  at: number
}

export interface GovtPoolResult<T> {
  rows: T[]
  source: GovtPoolSource
  /** Set when the database read failed (for logs / admin diagnostics). */
  error?: string
}

export interface GovtPoolDeps<T> {
  /** Strict read: MUST throw on any failure (never return a fallback). */
  fetchStrict: () => Promise<T[]>
  getLkg: () => GovtPoolSnapshot<T> | null
  setLkg: (s: GovtPoolSnapshot<T>) => void
  allowSeed: boolean
  seed: () => T[]
  /** Row-level "still active" filter (drops date-expired rows). */
  isActive: (row: T) => boolean
  now?: () => number
  maxAgeMs: number
  warn?: (msg: string) => void
}

export async function resolveGovtPool<T>(deps: GovtPoolDeps<T>): Promise<GovtPoolResult<T>> {
  const now = deps.now ?? Date.now
  const warn = deps.warn ?? (() => {})
  const lkg = () => {
    const s = deps.getLkg()
    return s && now() - s.at <= deps.maxAgeMs ? s : null
  }

  try {
    const rows = await deps.fetchStrict()
    if (rows.length === 0) {
      // A successful-but-empty read never displaces a still-fresh real dataset —
      // an empty table after a healthy one almost always means a bad read.
      const good = lkg()
      if (good && good.rows.length) {
        warn("[govtPool] database returned 0 rows; serving last-known-good dataset")
        return { rows: good.rows.filter(deps.isActive), source: "last-known-good" }
      }
      return { rows: [], source: "db" }
    }
    deps.setLkg({ rows, at: now() })
    return { rows, source: "db" }
  } catch (e) {
    const error = (e as Error)?.message ?? String(e)
    const good = lkg()
    if (good) {
      warn(`[govtPool] database unavailable (${error}); serving last-known-good dataset`)
      return { rows: good.rows.filter(deps.isActive), source: "last-known-good", error }
    }
    if (deps.allowSeed) {
      warn(`[govtPool] database unavailable (${error}); seed fallback is ALLOWED by policy (non-production)`)
      return { rows: deps.seed().filter(deps.isActive), source: "seed", error }
    }
    warn(`[govtPool] database unavailable (${error}); no last-known-good — reporting unavailable`)
    return { rows: [], source: "unavailable", error }
  }
}
