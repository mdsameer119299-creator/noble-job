/**
 * relatedLinks.ts — provenance-aware hrefs for "related jobs" blocks.
 *
 * A genuine, indexable job page must NEVER hand a crawlable link to a synthetic,
 * unclassified, closed or otherwise noindex job detail page (that would give
 * demo pages link equity and crawl discovery). The same rule as the sitemap:
 * only `isIndexable` rows (genuine AND open) are linkable from an indexable page.
 *
 * On a page that is itself noindex (a synthetic/demo listing), browsing
 * continuity between demo pages is preserved — those links sit on a noindex page
 * and the rows are never advertised anywhere indexable.
 */
import { isIndexable, jobDetailHref, type Classifiable } from "../jobs/provenance"
import { isRenderableJob, isValidJobId, type JobLike } from "../jobs/renderable"

export type RelatedBoard = "private" | "wfh" | "abroad"

/**
 * NO EMPTY JOBS: a related/recommended link is only ever produced for a record
 * that is renderable (real id, title, company, description, known provenance), on
 * indexable AND noindex pages alike — a link to an incomplete job would land on a
 * 404 (or worse, advertise an empty page).
 */
export function relatedJobHref(
  board: RelatedBoard,
  target: Classifiable & { id?: string | null },
  opts: { fromIndexablePage: boolean },
): string | null {
  if (!isValidJobId(target.id)) return null
  if (!isRenderableJob(target as JobLike, board)) return null
  if (!opts.fromIndexablePage) return `/jobs/${board}/${target.id}`
  return isIndexable(target) ? jobDetailHref(board, target) : null
}

/** Map jobs to links, dropping any that may not be linked from this page. */
export function toRelatedLinks<T extends Classifiable & { id?: string | null }, L>(
  board: RelatedBoard,
  jobs: readonly T[],
  opts: { fromIndexablePage: boolean; limit?: number },
  build: (job: T, href: string) => L,
): L[] {
  const out: L[] = []
  for (const j of jobs) {
    const href = relatedJobHref(board, j, opts)
    if (!href) continue
    out.push(build(j, href))
    if (opts.limit && out.length >= opts.limit) break
  }
  return out
}
