/**
 * featuredCardBadge.ts — the trust / source badge on a homepage "Featured Jobs" card.
 *
 * Deliberately INDEPENDENT of the link (featuredCardLink.ts). Where a card goes (internal detail page vs
 * external source) says nothing about how much we vouch for it: CURATED and OFFICIAL rows also get an
 * internal link, and an internal UUID is not verification. The badge is decided from the job's actual
 * PROVENANCE plus the verification evidence resolved by the application's own predicates
 * (`isEmployerVerified` in provenance.ts):
 *
 *   aggregator (Himalayas id / AGGREGATED)  → "Source ↗"        — external listing, never "Verified"
 *   EMPLOYER with verification evidence      → "Verified"
 *   EMPLOYER without it                      → "Employer listing" — owned by an employer, no verified claim
 *   CURATED                                  → "Curated"         — editorial pick, no employer claim
 *   OFFICIAL                                 → "Official source" — government/notification source
 *   SYNTHETIC / UNCLASSIFIED / unknown       → no badge (such cards are never rendered anyway)
 *
 * Pure, no server / Next imports, so the exact function the page ships is unit-testable.
 */
import { classifyProvenance, isEmployerVerified, type Classifiable } from './provenance'
import { isAggregatorCard } from './featuredCardLink'

export type FeaturedBadgeKind = 'verified' | 'employer' | 'source' | 'curated' | 'official'

export interface FeaturedCardBadge {
  kind: FeaturedBadgeKind
  label: string
}

export interface FeaturedCardBadgeInput {
  id: string
  /** Resolved provenance of the job (see `featuredCardTrust`). */
  provenance?: string
  /** Result of `isEmployerVerified` on the source job — evidence, never inferred from the link or id. */
  employerVerified?: boolean
}

const BADGES: Record<FeaturedBadgeKind, FeaturedCardBadge> = {
  verified: { kind: 'verified', label: 'Verified' },
  employer: { kind: 'employer', label: 'Employer listing' },
  source: { kind: 'source', label: 'Source ↗' },
  curated: { kind: 'curated', label: 'Curated' },
  official: { kind: 'official', label: 'Official source' },
}

/** The honest badge for a card, or `null` when there is nothing accurate to claim. */
export function featuredCardBadge(card: FeaturedCardBadgeInput): FeaturedCardBadge | null {
  // Non-genuine content gets no trust or source claim at all.
  if (card.provenance === 'SYNTHETIC' || card.provenance === 'UNCLASSIFIED') return null
  // An aggregator posting is an external-source listing whatever else it carries.
  if (isAggregatorCard({ id: card.id, provenance: card.provenance })) return BADGES.source
  switch (card.provenance) {
    case 'EMPLOYER':
      return card.employerVerified === true ? BADGES.verified : BADGES.employer
    case 'CURATED':
      return BADGES.curated
    case 'OFFICIAL':
      return BADGES.official
    default:
      return null
  }
}

/**
 * The trust fields stamped on a card when it is built from a job row: the resolved provenance (an explicit
 * known value wins, otherwise the fail-closed classifier) and whether the application's verification
 * predicate holds. Carrying these on the card is what lets the badge be decided from evidence.
 */
export function featuredCardTrust(job: Classifiable): { provenance: string; employerVerified: boolean } {
  return { provenance: classifyProvenance(job), employerVerified: isEmployerVerified(job) }
}
