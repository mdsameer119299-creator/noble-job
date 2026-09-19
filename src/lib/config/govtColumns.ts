/**
 * govtColumns.ts — explicit column projections for govt_jobs reads (PR-E2).
 *
 * Dependency-free (unit-testable without the RSC-coupled data source). Replaces
 * `select("*")` so the shared pool read (lists / stats / sitemap / related /
 * generateStaticParams) transfers only the light columns those consumers use,
 * while the heavy detail-body columns are fetched ONE ROW AT A TIME on the
 * detail page instead of for every active row on every pool read.
 */

/**
 * Light columns needed by every POOL consumer:
 *  - identity/URL: id, slug
 *  - card display: title, org, short, post, vacancies, qualification, age_range,
 *    fee, salary, location, state, tab, badge, color; stage URLs (result/admit/answer)
 *  - dates/sort/status: last_date, start_date, exam_date, created_at, status, sort_order
 *  - taxonomy/facets: state_slug, department, experience, category_tags, qualification_tags
 *  - govt indexability (govtClassifiable → sitemap filter + noindex): official_url,
 *    notification_url, notification_pdf, apply_url, job_status
 * Heavy detail-body columns are intentionally EXCLUDED — `enrichGovtJob`
 * synthesizes those when absent, and no pool consumer renders them.
 */
const LIST_COLUMNS = [
  "id", "slug", "title", "org", "short", "post", "vacancies", "qualification",
  "age_range", "fee", "last_date", "start_date", "exam_date", "salary", "location",
  "state", "tab", "status", "sort_order", "color", "badge",
  "notification_url", "official_url", "result_url", "admit_url", "answer_url",
  "created_at", "state_slug", "department", "experience",
  "category_tags", "qualification_tags", "job_status", "notification_pdf", "apply_url",
] as const

/** Heavy, detail-only body columns — fetched only for a single job on its page. */
const HEAVY_DETAIL_COLUMNS = [
  "overview", "eligibility", "age_limit", "salary_details", "exam_pattern",
  "syllabus_content", "article", "fee_details", "important_dates", "faqs",
  "selection_process", "vacancy_breakup",
] as const

/** Exposed for tests. */
export const GOVT_LIST_COLUMN_LIST: readonly string[] = LIST_COLUMNS
export const GOVT_HEAVY_DETAIL_COLUMN_LIST: readonly string[] = HEAVY_DETAIL_COLUMNS

/** PostgREST select() for the shared pool (light). */
export const GOVT_LIST_COLUMNS = LIST_COLUMNS.join(", ")

/** PostgREST select() for a single detail row (light + heavy body columns). */
export const GOVT_DETAIL_COLUMNS = [...LIST_COLUMNS, ...HEAVY_DETAIL_COLUMNS].join(", ")

/**
 * Record-integrity columns (migration 20260727000001). Kept OUT of the base
 * projections above so a database that has not been migrated yet still serves
 * the pool: readers ask for `withGovtIntegrityColumns(...)` first and retry with
 * the base projection when Postgres reports the columns do not exist.
 */
export const GOVT_INTEGRITY_COLUMN_LIST: readonly string[] = [
  "record_type",
  "source_published_at",
  "content_changed_at",
  "verified_at",
  "verified_by",
]

/** Append the record-integrity columns to a base projection. */
export function withGovtIntegrityColumns(base: string): string {
  return `${base}, ${GOVT_INTEGRITY_COLUMN_LIST.join(", ")}`
}
