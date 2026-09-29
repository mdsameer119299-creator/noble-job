import type { Database } from "@/types/supabase"

/**
 * Database type overlay for the application admin-review gate.
 *
 * `src/types/supabase.ts` is generated from the database schema and is not
 * changed by feature migrations until types are regenerated. This narrow
 * overlay keeps the generated file untouched while allowing the server/admin
 * Supabase clients to type the new application review columns.
 */
type BaseApplications = Database["public"]["Tables"]["applications"]

type ApplicationGateTable = {
  Row: BaseApplications["Row"] & {
    admin_review_status: "pending_review" | "approved" | "rejected" | "shared"
    admin_reviewed_at: string | null
    admin_reviewed_by: string | null
  }
  Insert: BaseApplications["Insert"] & {
    admin_review_status?: "pending_review" | "approved" | "rejected" | "shared"
    admin_reviewed_at?: string | null
    admin_reviewed_by?: string | null
  }
  Update: BaseApplications["Update"] & {
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
