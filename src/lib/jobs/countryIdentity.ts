/**
 * countryIdentity.ts — ONE definition of "is this stored country the country the visitor asked for?".
 *
 * Why this exists. The Abroad country cards, the list each card opens, the local demo inventory and the
 * live external feed all filter by country. They used to do it with three different raw string rules
 * (SQL `ILIKE %c%` substring, case-insensitive equality, substring of "country location"), which gave
 * wrong *identity* answers even where card and list agreed with each other:
 *
 *   • "UK"   matched "Ukraine" (substring) but missed "United Kingdom" (what Himalayas rows store);
 *   • "Oman" matched "Romania" (substring);
 *   • "UAE"  missed "United Arab Emirates" (what an employer may type).
 *
 * Rule now: both sides are NORMALISED and mapped through an alias table to a canonical country key, and a
 * stored value matches only when one of its country TOKENS (the whole value, or a comma / slash / bracket
 * separated part of it, e.g. "Dubai, UAE" or "UAE (Dubai)") canonicalises to the requested country. There
 * is no substring matching anywhere, so one country's name can never match another's.
 *
 *   countryMatches("United Kingdom", "UK")  → true       countryMatches("Ukraine", "UK")     → false
 *   countryMatches("Romania", "Oman")       → false      countryMatches("OMAN", "oman")      → true
 *   countryMatches("United Arab Emirates", "UAE") → true  countryMatches("Dubai, UAE", "UAE") → true
 *
 * Pure (no server / Next imports) so every path — Supabase rows, local inventory, live feed — and the unit
 * tests use the exact same function.
 *
 * ALIAS POLICY: only names/abbreviations of the country itself. ISO alpha-2 codes are included solely for
 * the countries the live provider is queried with (liveJobOpportunities.ts: US,GB,CA,AE,AU,DE,SG,SA,QA,NZ),
 * because that feed returns `country` as a code. Cities, regions and nationalities are NOT aliases.
 */

/** canonical display name → accepted spellings (any case / punctuation; normalised below). */
const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "United Arab Emirates": ["UAE", "U.A.E.", "United Arab Emirates", "Emirates", "AE"],
  "Saudi Arabia": ["Saudi Arabia", "Saudi", "KSA", "Kingdom of Saudi Arabia", "SA"],
  "Qatar": ["Qatar", "QA"],
  "United Kingdom": ["UK", "U.K.", "United Kingdom", "Great Britain", "Britain", "GB"],
  "Canada": ["Canada", "CA"],
  "Australia": ["Australia", "AU"],
  "Singapore": ["Singapore", "SG"],
  "Germany": ["Germany", "Deutschland", "DE"],
  "Malaysia": ["Malaysia"],
  "France": ["France"],
  "Netherlands": ["Netherlands", "The Netherlands", "Holland"],
  "Ireland": ["Ireland", "Republic of Ireland"],
  "Oman": ["Oman", "Sultanate of Oman"],
  "Kuwait": ["Kuwait"],
  "Bahrain": ["Bahrain"],
  "New Zealand": ["New Zealand", "NZ"],
  "United States": ["USA", "U.S.A.", "US", "U.S.", "United States", "United States of America"],
}

/**
 * lowercase, strip diacritics, drop dots ("U.A.E." → "uae"), turn every other non-alphanumeric run into one
 * space, trim. "" for anything blank / non-string.
 */
export function normalizeCountryText(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const ALIAS_TO_CANONICAL: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>()
  for (const [canonical, names] of Object.entries(COUNTRY_ALIASES)) {
    for (const name of [canonical, ...names]) map.set(normalizeCountryText(name), normalizeCountryText(canonical))
  }
  return map
})()

/**
 * Canonical key of ONE country token: a known alias → its canonical country, otherwise the normalised text
 * itself (so an unlisted country such as "Japan" still matches "japan"/"JAPAN" — equality, never substring).
 * "" when blank.
 */
export function canonicalCountry(raw: unknown): string {
  const n = normalizeCountryText(raw)
  if (!n) return ""
  return ALIAS_TO_CANONICAL.get(n) ?? n
}

/** Separators that split a free-text value into country tokens: , ; / | \ ( ) [ ] and spaced dashes. */
const TOKEN_SPLIT = /[,;/\\|()[\]\n]|\s[-–—]\s/

/** Every canonical country key a stored value names: the whole value plus each separated part. */
function storedCountryKeys(stored: unknown): Set<string> {
  const keys = new Set<string>()
  if (typeof stored !== "string") return keys
  const whole = canonicalCountry(stored)
  if (whole) keys.add(whole)
  for (const part of stored.split(TOKEN_SPLIT)) {
    const k = canonicalCountry(part)
    if (k) keys.add(k)
  }
  return keys
}

/**
 * Does a stored country value (a DB column, a local-inventory field, a live feed field) denote the country
 * the visitor asked for? A blank `requested` means "no country filter" and matches everything, as every
 * list does when `?country=` is absent.
 */
export function countryMatches(stored: unknown, requested: unknown): boolean {
  const want = canonicalCountry(requested)
  if (!want) return true
  return storedCountryKeys(stored).has(want)
}

/** Narrow rows by their country field with the shared rule. Blank `requested` → all rows, same array order. */
export function filterByCountry<T extends { country?: unknown }>(rows: readonly T[], requested: unknown): T[] {
  if (!canonicalCountry(requested)) return [...rows]
  return rows.filter(r => countryMatches(r.country, requested))
}
