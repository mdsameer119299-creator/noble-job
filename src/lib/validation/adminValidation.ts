/**
 * adminValidation.ts — pure, dependency-free validators for the admin API.
 *
 * Extracted so the `/api/admin/*` route can validate mutation bodies and
 * pagination params consistently, and so the rules are unit-testable with the
 * `tsx` harness (no Next/Supabase imports). No I/O, no side effects.
 */

/** Hard cap on rows returned by any admin list endpoint (bounds "unbounded" scans). */
export const ADMIN_LIST_MAX_LIMIT = 500
/** Max characters for a single site-content / admin-setting value. */
export const ADMIN_VALUE_MAX_LEN = 20000
/** Max entries accepted in one settings/content PUT body. */
export const ADMIN_KV_MAX_KEYS = 100
/** Max characters for a key. */
export const ADMIN_KEY_MAX_LEN = 64

export type KeyValueValidation =
  | { ok: true; entries: Array<[string, string]> }
  | { ok: false; error: string }

/**
 * Validate a flat `{ key: value }` mutation body (used by settings + content
 * PUT). Requires a plain object of primitive values; each key must be a
 * non-empty string ≤ ADMIN_KEY_MAX_LEN and each value coerces to a string
 * ≤ ADMIN_VALUE_MAX_LEN. Rejects arrays, null, nested objects and empty bodies.
 */
export function validateKeyValueBody(body: unknown): KeyValueValidation {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object of key/value pairs" }
  }
  const obj = body as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return { ok: false, error: "No fields provided" }
  if (keys.length > ADMIN_KV_MAX_KEYS) return { ok: false, error: `Too many fields (max ${ADMIN_KV_MAX_KEYS})` }

  const entries: Array<[string, string]> = []
  for (const key of keys) {
    const k = key.trim()
    if (!k) return { ok: false, error: "Empty key is not allowed" }
    if (k.length > ADMIN_KEY_MAX_LEN) return { ok: false, error: `Key "${k.slice(0, 20)}…" is too long` }
    const raw = obj[key]
    if (raw === null || raw === undefined) return { ok: false, error: `Missing value for "${k}"` }
    if (typeof raw === "object") return { ok: false, error: `Value for "${k}" must be a string, number or boolean` }
    const value = String(raw)
    if (value.length > ADMIN_VALUE_MAX_LEN) return { ok: false, error: `Value for "${k}" exceeds ${ADMIN_VALUE_MAX_LEN} characters` }
    entries.push([k, value])
  }
  return { ok: true, entries }
}

export interface Pagination {
  limit: number
  offset: number
  q: string
}

/** Read/clamp pagination + search params for admin list endpoints. `limit`
 *  defaults to and is capped at ADMIN_LIST_MAX_LIMIT; `offset` is ≥ 0. */
export function parsePagination(get: (k: string) => string | null): Pagination {
  const rawLimit = Number(get("limit"))
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), ADMIN_LIST_MAX_LIMIT)
    : ADMIN_LIST_MAX_LIMIT
  const rawOffset = Number(get("offset"))
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0
  const q = (get("q") || "").trim()
  return { limit, offset, q }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** True when `s` is a well-formed UUID (used to validate path ids before a query). */
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s)
}

/** Parse a comma-separated `jobIds` param into a bounded, de-duped UUID list
 *  (used to scope the per-job application-count query). Empty → null. */
export function parseJobIds(raw: string | null): string[] | null {
  if (!raw) return null
  const ids = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter((s) => isUuid(s))))
  return ids.length ? ids.slice(0, ADMIN_LIST_MAX_LIMIT) : null
}
