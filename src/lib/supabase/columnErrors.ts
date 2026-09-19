/**
 * columnErrors.ts — recognise "this column does not exist yet" errors so code
 * that reads/writes columns added by a not-yet-applied migration can degrade to
 * the previous column set instead of failing outright.
 *
 * Postgres: 42703 undefined_column. PostgREST: PGRST204 (write payload names a
 * column missing from the schema cache) and messages such as
 * `column govt_jobs.record_type does not exist`.
 */
export function isMissingColumnError(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  if (err.code === "42703" || err.code === "PGRST204") return true
  const m = (err.message ?? "").toLowerCase()
  return (
    (m.includes("column") && m.includes("does not exist")) ||
    (m.includes("could not find the") && m.includes("column"))
  )
}
