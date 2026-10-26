/**
 * detailMiss.ts — make a detail-page MISS observable.
 *
 * `getWfhJobById` / `getAbroadJobById` return null for several different reasons (id rejected, no client, database
 * error, no row, row rejected by the renderability gate, an exception) and every one of them rendered the same
 * silent 404 — nothing in the runtime logs said which. One structured line per miss, never any row content or
 * secret: board, id, a reason code and a short, non-sensitive detail.
 */
export type DetailMissReason =
  | "invalid-id"
  | "local-or-unconfigured"
  | "no-client"
  | "db-error"
  | "no-row"
  | "not-renderable"
  | "exception"
  | "fallback-null"

export function logDetailMiss(board: "wfh" | "abroad", id: string, reason: DetailMissReason, detail?: string): void {
  try {
    console.warn(`[detail-miss] ${JSON.stringify({ board, id: String(id).slice(0, 80), reason, detail: detail ? detail.slice(0, 160) : undefined })}`)
  } catch {
    /* logging must never affect rendering */
  }
}
