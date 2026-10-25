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
import type { GovtJob } from "@/types/govtJob"

export function mapRow(row: Record<string, unknown>): GovtJob {
  const r = row as unknown as GovtJob & { last_date?: string; age_range?: string }
  return applyGovtVacancies({
    ...r,
    // Captured BEFORE applyGovtVacancies can synthesize a display count.
    vacanciesStated: parseVacancyCount(r.vacancies) !== null ? String(r.vacancies).trim() : undefined,
    lastDate: r.lastDate ?? r.last_date,
    last_date: r.last_date ?? r.lastDate,
    ageRange: r.ageRange ?? r.age_range,
    age_range: r.age_range ?? r.ageRange,
    // Record-integrity columns (absent on an unmigrated database → undefined).
    recordType: isGovtRecordType(r.record_type) ? r.record_type : undefined,
    sourcePublishedAt: r.source_published_at ?? undefined,
    contentChangedAt: r.content_changed_at ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    verifiedBy: r.verified_by ?? undefined,
  }, { synthesize: false }) as GovtJob
}
