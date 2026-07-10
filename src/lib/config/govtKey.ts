/**
 * govtKey.ts — how a public govt-job key (from the URL) maps to exact-match
 * lookups. Dependency-free (unit-testable).
 *
 * A key is resolved with separate parameterized `.eq()` queries — slug first
 * (public URLs are slugs), then id — instead of interpolating the raw key into
 * a combined PostgREST `.or()` expression. supabase-js encodes the value for
 * `.eq()`, so:
 *   • colon-containing ids (e.g. "mppsc:mppsc-2025-20-06-20") resolve correctly;
 *   • filter-breaking characters (`,` `(` `)`) can never inject extra filters —
 *     the key is a VALUE, never part of the filter grammar.
 * The key is therefore passed through VERBATIM (no stripping that would corrupt
 * legitimate ids); only surrounding whitespace is trimmed.
 */

export type GovtKeyColumn = "slug" | "id"

/** Ordered [column, value] exact-match lookups for a public govt-job key. */
export function govtKeyLookups(key: string): ReadonlyArray<readonly [GovtKeyColumn, string]> {
  const k = (key ?? "").trim()
  if (!k) return []
  return [
    ["slug", k],
    ["id", k],
  ] as const
}
