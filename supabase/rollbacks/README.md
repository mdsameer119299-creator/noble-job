# Rollback scripts

One `<version>_<name>.down.sql` per forward migration in `../migrations/`, reversing it by hand.

**These must stay out of `supabase/migrations/`.** The Supabase CLI applies every `<digits>_<anything>.sql` file in that folder
as a migration and uses the digits as its version, so `20261026000001_x.down.sql` would be read as a *second* migration with
the same version as `20261026000001_x.sql`. `supabase db push` / `db reset` then runs the rollback first (it sorts first) and
fails with `duplicate key value violates unique constraint "schema_migrations_pkey"`.

- The CLI never reads this folder. Run a rollback deliberately, against a database you mean to change:
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/rollbacks/<version>_<name>.down.sql`
  (after a rollback, also remove that version from `supabase_migrations.schema_migrations`, or `db push` will consider it applied).
- `src/lib/db/migrationLayout.test.ts` (`npm run test:migration-layout`, part of `test:seo-phase1`) fails if a rollback, a
  non-`.sql` file or a duplicate version appears in `supabase/migrations/`, and if a rollback here has no forward migration.
- A rollback is a recovery aid, not an automated step: review it before running it.
