# Production database compatibility + migration safety (review; no DB was touched)

Decision: cutover keeps the EXISTING production Supabase. Staging Supabase is for all Preview/integration testing.

## Finding: the integrated code needs NO new migration
`integration/launch` vs `main` changes no `.sql` under `supabase/` (only docs SQL). Relevant existing objects:
- `analytics_events` — migration `20260709000001_analytics_events.sql` (+ down script in `supabase/rollbacks/`) already exists in main. `/api/events` writes to it when present and silently ignores a missing table → **confirm it exists in production**; if it does not, funnel data is simply not stored (no errors for users).
- `candidates.category`, `experience_years`, `phone` nullable; `skills` default '{}' — the simplified signup relies on this → **confirm in production** (the repo schema says yes; production may have drifted).
- `profile_score` trigger — must tolerate null category/experience.
- RLS (employers see only applicants), storage policies for resumes.

## Read-only verification SQL for the owner (run in the production SQL editor; all SELECT)
```sql
select to_regclass('public.analytics_events') is not null as analytics_events_exists;
select column_name, is_nullable, column_default from information_schema.columns
 where table_schema='public' and table_name='candidates' and column_name in ('category','experience_years','phone','skills','resume_url','profile_score');
select tgname from pg_trigger where tgrelid='public.candidates'::regclass and not tgisinternal;
select schemaname, tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('candidates','applications','jobs','analytics_events') order by 2,3;
select version from supabase_migrations.schema_migrations order by version desc limit 5;  -- compare with supabase/migrations
```
Compare the output with the staging project built from the repo; differences = drift to resolve before cutover.

## Rules for any future production migration
1. Additive only (new nullable columns/tables/indexes `CONCURRENTLY`); never drop/rename in the cutover window.
2. Reviewed SQL + a matching down script; tested on staging first.
3. Backup / PITR timestamp recorded immediately before.
4. Apply manually by the owner (not by CI/Vercel), outside peak hours; run verification SQL after.
5. Rollback plan: down script + code rollback via domain move (see PRODUCTION_CUTOVER_PLAN.md §C.4).

## Production-data safety during integration
No production credentials in any Preview (new or old project) — see OWNER_VERCEL_ACTIONS.md. Synthetic data only on staging.
