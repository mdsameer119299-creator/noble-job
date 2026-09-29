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
 */
type BaseApplications = Database["public"]["Tables"]["applications"]

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
    Tables: Omit<Database["public"]["Tables"], "applications"> & {
      applications: ApplicationGateTable
    }
  }
}
