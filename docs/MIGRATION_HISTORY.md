# Migration history — live vs repository

Read-only audit of the live `supabase_migrations.schema_migrations` table and the live catalogs, 2026-10-28 (33 rows).
No connection details, tokens or statement text are recorded here. The version/name inventory is pinned in
`supabase/rehearsal/live-history-inventory.json`, and `src/lib/db/migrationLayout.test.ts` asserts everything below.

## 1. 20261025 — resume-download gate (aligned)

| | Live history | Repository |
|---|---|---|
| Before | `20261025102650_refix_storage_resume_employer_applicant` | `20261025000001_refix_storage_resume_employer_applicant.sql` (a draft version that never existed live) |
| Now | unchanged | `supabase/migrations/20261025102650_refix_storage_resume_employer_applicant.sql` (+ matching rollback in `supabase/rollbacks/`) |

Why this is safe to align by renaming the repository file and not the live history:

- The executable SQL recorded live is identical to the repository file (comments and whitespace aside): normalised md5
  `3e1719a145c35a948f9f988d7525292c`, 583 characters, on both sides. The live function definition matches it.
- Only the filename and the stale header comment changed. The SQL from `CREATE OR REPLACE FUNCTION` to the end of the file is
  byte-for-byte unchanged (sha256 `a35254db2c058fe196e07fee33c09bbf27b22938c4ef4b3c9ab8e60263054af4`), and the test pins that.
- The Supabase CLI compares versions. Renaming removes the two mismatches at once: the live-only version is now represented
  locally, and the repository-only draft version is gone. No history repair is involved.

## 2. Nine live rows are named `<name>.down`

Live versions 20260610000001, 20260616000001/2/3, 20260706000001, 20260930000001/2/3 and 20261001000001 record, as their SQL,
the text of the rollback script, under the forward version. In every case the live schema is in the FORWARD state
(columns, constraints, indexes, policies, functions and triggers were checked). The versions match local forward files, so they
do not block `db push`; only the recorded name and statement text differ. Do not run those rollbacks. In particular the
rollback for 20261001000001 would reopen the `users.role` privilege escalation.

How those rows came to hold rollback text cannot be established read-only (evidence needed: Postgres or management-API logs from
the dates in question). Changing live history is a human decision; this repository does not do it.

## 3. Pending: 20261026000001

After the alignment above, the only local migration the live history lacks is
`20261026000001_govt_jobs_verification_integrity.sql`. It is newer than every live version, replaces two trigger functions and
three column comments, and is NOT applied. Apply it only with explicit approval.

## 4. Separately tracked issue — `synthetic_jobs_visible` is missing

`20260929000003_disable_public_synthetic_inventory` is recorded as applied, but the `admin_settings` row it writes
(`synthetic_jobs_visible = 'false'`) does not exist live (the table holds four other keys). This is a data effect, not a schema
one. Application code treats the key as fail-closed (`src/lib/jobs/syntheticVisibility.ts`: only the string `"true"` shows
synthetic rows), so nothing is exposed today. It has deliberately NOT been fixed here: no row is inserted or updated by this
change, and the migration file is not edited. Whether to re-seed it, and how, needs a human decision. Unknown: whether the
migration never ran or the row was later deleted (needs database logs).

## 5. Rules

- Never edit an applied forward migration other than its header comments; the evidence suite pins the applied bodies.
- Never run `supabase migration repair` or change `schema_migrations` without written approval of the exact history-only change.
- Rehearse `db push --dry-run` against a disposable database seeded from the inventory file, never against the live database.
