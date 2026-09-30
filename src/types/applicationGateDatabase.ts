import type { Database } from "@/types/supabase"

/**
 * Database type overlay for the application admin-review gate.
 *
 * `src/types/supabase.ts` is generated from the database schema and is not
 * changed by feature migrations until types are regenerated. This narrow
 * overlay keeps the generated file untouched while allowing the server/admin
 * Supabase clients to type the new application review columns.
 *
 * It also corrects one pre-existing drift between the generated types and
 * the real schema: `applications.job_id` has no `NOT NULL` constraint in
 * `supabase/migrations/20250603000001_initial_schema.sql` (it's a plain
 * `REFERENCES jobs(id) ON DELETE CASCADE`), so applications for a
 * source-tracked-but-not-locally-stored job (`jobExists` false in the apply
 * route) are legitimately inserted with `job_id: null`. The generated
 * `Database` type declares it as non-nullable `string`, which is stale
 * relative to the schema, not a real constraint — this overlay narrows it
 * back to `string | null` rather than papering over the mismatch with an
 * `as any` cast at the call site.
 *
 * It also widens `wfh_jobs` the same way, for columns real migrations added
 * that the generated file was never regenerated to include: the lifecycle
 * columns from `20260727000002_job_lifecycle_foundation.sql` /
 * `20260727000003_job_source_posted_at.sql` (`application_deadline`,
 * `last_confirmed_open_at`, `closed_at`, `source_posted_at`) and the sourced-
 * inventory columns from `20260930000001_wfh_source_and_applicant_country.sql`
 * (`source`, `applicant_country`). Used by the Himalayas WFH ingestion
 * (`src/lib/services/himalayasWfhIngest.ts`), which reads/writes them via
 * `supabaseAdmin` and degrades gracefully with `isMissingColumnError` if a
 * given database has not applied the migration yet.
 */
type BaseApplications = Database["public"]["Tables"]["applications"]
type BaseWfhJobs = Database["public"]["Tables"]["wfh_jobs"]

type WfhJobsLifecycleFields = {
  application_deadline?: string | null
  last_confirmed_open_at?: string | null
  closed_at?: string | null
  source_posted_at?: string | null
  source?: string | null
  applicant_country?: string | null
}

type WfhJobsRow = BaseWfhJobs["Row"] & WfhJobsLifecycleFields

type WfhJobsGateTable = {
  Row: WfhJobsRow
  // The generated Insert/Update types only declare a handful of columns (a
  // pre-existing drift, same as `applications` above) — widen to every real
  // column (Row, optional) plus the lifecycle fields, so a full-row upsert /
  // partial lifecycle update type-checks against the actual schema.
  Insert: Partial<WfhJobsRow> & Pick<BaseWfhJobs["Insert"], "id" | "title" | "company">
  Update: Partial<WfhJobsRow>
  Relationships: BaseWfhJobs["Relationships"]
}

type ApplicationGateTable = {
  Row: Omit<BaseApplications["Row"], "job_id"> & {
    job_id: string | null
    admin_review_status: "pending_review" | "approved" | "rejected" | "shared"
    admin_reviewed_at: string | null
    admin_reviewed_by: string | null
  }
  Insert: Omit<BaseApplications["Insert"], "job_id"> & {
    job_id?: string | null
    admin_review_status?: "pending_review" | "approved" | "rejected" | "shared"
    admin_reviewed_at?: string | null
    admin_reviewed_by?: string | null
  }
  Update: Omit<BaseApplications["Update"], "job_id"> & {
    job_id?: string | null
    admin_review_status?: "pending_review" | "approved" | "rejected" | "shared"
    admin_reviewed_at?: string | null
    admin_reviewed_by?: string | null
  }
  Relationships: BaseApplications["Relationships"]
}

export type ApplicationGateDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "applications" | "wfh_jobs"> & {
      applications: ApplicationGateTable
      wfh_jobs: WfhJobsGateTable
    }
  }
}
