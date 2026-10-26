/**
 * featuredCardLink.ts — where (and whether) a homepage "Featured Jobs" card links.
 *
 * Two kinds of card reach the homepage:
 *
 *  • NATIVE   — an employer-owned row in our own `jobs` / `wfh_jobs` / `abroad_jobs` tables.
 *               It links to its internal detail page, `/jobs/<board>/<id>`.
 *  • AGGREGATOR — a third-party posting (Himalayas ids are shaped `himalayas:<sha1>`, provenance
 *               AGGREGATED). It links ONLY to its real external application URL.
 *
 * An aggregator card must never get an internal detail href: `getJobById()` reads only the
 * `jobs` table, so `/jobs/private/himalayas:<id>` is a guaranteed 404, and an internal link would
 * also present an external listing as if it were hosted/vouched for by us. So when an aggregator
 * card has no valid, actionable external URL there is NO fallback — `featuredCardLink()` returns
 * `null` and the card is dropped (see getFeaturedJobsMix and FeaturedJobsSection). A destination
 * is never invented.
 *
 * Pure and free of server / Next imports so the exact function the page ships is unit-testable.
 */
import { hasRealApplyUrl } from './provenance'
import { isValidJobId } from './renderable'

export interface FeaturedCardLinkInput {
  id: string
  board: 'private' | 'wfh' | 'abroad'
  apply_url?: string
  provenance?: string
}

export interface FeaturedCardLink {
  href: string
  external: boolean
}

/** Id prefix of every Himalayas-ingested / Himalayas-cached job (see himalayas*Ingest / himalayasService). */
const AGGREGATOR_ID_PREFIX = 'himalayas:'

/** True for a third-party (aggregated) posting: a Himalayas id OR an explicit AGGREGATED provenance. */
export function isAggregatorCard(card: Pick<FeaturedCardLinkInput, 'id' | 'provenance'>): boolean {
  return card.id.startsWith(AGGREGATOR_ID_PREFIX) || card.provenance === 'AGGREGATED'
}

/**
 * The URL when — and only when — it is a real, actionable, safe external destination; else `null`.
 *
 * Builds ON TOP of the platform's own `hasRealApplyUrl` (blank, `#`, `example.*` placeholders and any
 * non-http(s) scheme are already rejected there) and never relaxes it. On top of that it requires a
 * structurally valid absolute URL with a real host, no embedded credentials, and no whitespace or
 * control characters — so `https://`, `https:///x`, `https://user:pw@host/`, `javascript:…`, `data:…`,
 * `//host/path` and `/relative` can never become an href.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim()
  if (!url) return null
  if (/[\s\u0000-\u001f\u007f]/.test(url)) return null
  if (!hasRealApplyUrl(url)) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (parsed.username || parsed.password) return null
  // A real public host has at least one dot ("localhost", "intranet", "[::1]" are not job sites).
  if (!parsed.hostname || !parsed.hostname.includes('.')) return null
  return url
}

/**
 * The link for a card, or `null` when the card cannot be linked safely and must not be rendered.
 *
 *  • aggregator → `{ href: <valid external URL>, external: true }` or `null` — NEVER an internal href;
 *  • native     → `{ href: '/jobs/<board>/<id>', external: false }` for a valid id on a genuine card;
 *  • anything else (invalid id, SYNTHETIC / UNCLASSIFIED provenance) → `null`.
 */
export function featuredCardLink(card: FeaturedCardLinkInput): FeaturedCardLink | null {
  if (isAggregatorCard(card)) {
    const href = safeExternalUrl(card.apply_url)
    return href ? { href, external: true } : null
  }
  if (!isValidJobId(card.id)) return null
  if (card.provenance === 'SYNTHETIC' || card.provenance === 'UNCLASSIFIED') return null
  return { href: `/jobs/${card.board}/${card.id}`, external: false }
}

/** Keep only the cards that have a safe link, preserving order. */
export function onlyLinkableCards<T extends FeaturedCardLinkInput>(cards: readonly T[]): T[] {
  return cards.filter(c => featuredCardLink(c) !== null)
}
