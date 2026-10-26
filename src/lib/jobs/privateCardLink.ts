/**
 * privateCardLink.ts — where (and whether) a Private-board LISTING card links.
 *
 * The Private list merges two sources (see mergePrivateListing):
 *   • employer-owned rows of our own `jobs` table → an internal detail page, `/jobs/private/<id>`;
 *   • live third-party (Himalayas) postings → ids shaped `himalayas:<sha1>`.
 *
 * The detail route resolves ids from the `jobs` table only (getJobById; the live-feed lookup is disabled),
 * so `/jobs/private/himalayas:<id>` is a guaranteed 404 — and an internal link would also present an
 * external posting as hosted by us. An external-source card therefore links ONLY to its own validated
 * http(s) application/source URL (new tab, noopener). With no valid URL it is NOT linked at all
 * ("unavailable": a plain card with no destination) — a destination is never invented or substituted.
 *
 * Provenance, verification and apply rules are untouched: this only decides the href.
 *
 * Pure (no server / Next imports) so the exact function the card ships is unit-testable.
 */
import { isGenuine, jobDetailHref, type Classifiable } from "./provenance"
import { safeExternalUrl } from "./featuredCardLink"

export type PrivateCardLink =
  /** Third-party posting → its own source/application URL, opened in a new tab. */
  | { kind: "external"; href: string }
  /** Employer-owned, genuine → the working internal detail page. */
  | { kind: "internal"; href: string }
  /** Third-party posting with no valid source URL (or not a genuine posting) → render the card with NO link. */
  | { kind: "unavailable" }
  /** Not a genuine employer job (sample / unclassified) → no detail link; the card keeps its "Similar Jobs" path. */
  | { kind: "none" }

/** Id prefix of every Himalayas-ingested / Himalayas-cached job (same convention as featuredCardLink). */
export const EXTERNAL_SOURCE_ID_PREFIX = "himalayas:"

/** True for an id that belongs to the live third-party feed, which has NO internal detail page. */
export function isExternalSourceId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith(EXTERNAL_SOURCE_ID_PREFIX)
}

export function privateCardLink(job: Classifiable & { id?: string | null }): PrivateCardLink {
  const id = (job.id ?? "").toString()
  if (isExternalSourceId(id)) {
    // Never linked when it is explicitly sample/unclassified, whatever its URL looks like — and there is
    // no internal fallback either: a third-party card with no valid destination simply has no link.
    if (!isGenuine(job)) return { kind: "unavailable" }
    const href = safeExternalUrl((job.applyUrl ?? job.apply_url ?? "").toString())
    return href ? { kind: "external", href } : { kind: "unavailable" }
  }
  const internal = jobDetailHref("private", job)
  return internal ? { kind: "internal", href: internal } : { kind: "none" }
}
