/**
 * featuredCardLink.ts — where a homepage "Featured Jobs" card points.
 *
 * Aggregated external jobs (Himalayas-sourced, ids shaped `himalayas:<sha1>`) live in the
 * `wfh_jobs` / `abroad_jobs` cache tables, but internal detail pages resolve through
 * `getJobById()`, which only reads the `jobs` table. An internal `/jobs/<board>/himalayas:<id>`
 * link therefore always 404s. Those cards link straight to their real source URL instead.
 *
 * Kept free of server / Next imports so the exact function the page ships is unit-testable.
 */
export interface FeaturedCardLinkInput {
  id: string
  board: 'private' | 'wfh' | 'abroad'
  apply_url?: string
}

export interface FeaturedCardLink {
  href: string
  external: boolean
}

export function featuredCardLink(card: FeaturedCardLinkInput): FeaturedCardLink {
  if (card.apply_url && card.id.startsWith('himalayas:')) {
    return { href: card.apply_url, external: true }
  }
  return { href: `/jobs/${card.board}/${card.id}`, external: false }
}
