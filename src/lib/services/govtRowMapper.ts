/**
 * govtRowMapper.ts — snake_case Supabase row -> GovtJob, with vacancy
 * normalisation.
 *
 * Split out of govtStatsSource.ts so it can be unit-tested without the Next
 * runtime: govtStatsSource.ts calls React's `cache()` / `unstable_cache()` at
 * module scope, so merely importing it outside Next crashes
 * ("(0, import_react.cache) is not a function") — this module has no such
 * dependency and stays plain, dependency-free TypeScript.
 *
 * synthesize:false — every row mapped here is a REAL DB-backed row
 * (adapter-ingested or curated seed), never the in-memory demo/fallback
 * dataset, so a missing source vacancy count must surface as "Not Specified"
 * rather than a fabricated keyword-profile number. See applyGovtVacancies's
 * and enrichGovtJob's own doc comments for the synthesize=true/false
 * contract this mirrors.
 */
import { applyGovtVacancies, parseVacancyCount } from "@/lib/data/govtVacancies"
import { isGovtRecordType } from "@/lib/govt/recordType"
import { applyVacancyDisplayGate } from "@/lib/govt/vacancyFigure"
import type { GovtJob } from "@/types/govtJob"

export function mapRow(row: Record<string, unknown>): GovtJob {
  const r = row as unknown as GovtJob & { last_date?: string; age_range?: string; vacancy_breakup?: GovtJob["vacancyBreakup"] }
  const mapped = applyGovtVacancies({
    ...r,
    // Captured BEFORE applyGovtVacancies can synthesize a display count.
    vacanciesStated: parseVacancyCount(r.vacancies) !== null ? String(r.vacancies).trim() : undefined,
    lastDate: r.lastDate ?? r.last_date,
    last_date: r.last_date ?? r.lastDate,
    ageRange: r.ageRange ?? r.age_range,
    age_range: r.age_range ?? r.ageRange,
    // Normalize snake_case DB column so the vacancy display gate can inspect and
    // scrub every break-up sub-total, not just the aggregate figure.
    vacancyBreakup: r.vacancyBreakup ?? r.vacancy_breakup,
    // Record-integrity columns (absent on an unmigrated database → undefined).
    recordType: isGovtRecordType(r.record_type) ? r.record_type : undefined,
    sourcePublishedAt: r.source_published_at ?? undefined,
    contentChangedAt: r.content_changed_at ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    verifiedBy: r.verified_by ?? undefined,
  }, { synthesize: false }) as GovtJob
  // The ONE place a stored row becomes a GovtJob, so every route (cards, listings, detail, metadata, JSON-LD, sitemap,
  // counts) sees the same record: a figure the official notice does not support is withheld, and a placeholder closing
  // date is filled from a reviewed notice. See govt/vacancyFigure.ts.
  return applyVacancyDisplayGate(mapped)
}
