# Staging Supabase — exact setup (owner does steps 1–6 directly in Supabase/Vercel; NEVER paste keys in chat or commit them)

Hard rules: staging project only · no production URL/keys/DB password anywhere in Preview · no real user data · staging values never reused in Production.

## 1. Create the project
Supabase → New project "noble-job-staging" (any region; Free plan is fine). Save the DB password in your password manager. Do **not** copy production settings by dashboard "restore/clone".

## 2. Apply migrations — exact order (verified from empty on local Postgres 16 with Supabase-style stubs: 34/34 applied, 0 errors; 33 public tables)
Option A (SQL Editor): run each file in `supabase/migrations/` **in filename order**, one at a time, stop on the first error:
```
20250603000001_initial_schema.sql        20260709000001_analytics_events.sql        20260929000003_disable_public_synthetic_inventory.sql
20250603000002_rls_policies.sql          20260723000001_job_reports.sql             20260930000001_wfh_source_and_applicant_country.sql
20250603000003_indexes.sql               20260724000001_wfh_abroad_employer_ownership.sql   20260930000002_fix_candidate_applications_rls_recursion.sql
20250603000004_functions.sql             20260725000001_wfh_abroad_featured.sql     20260930000003_freeze_moderation_columns.sql
20250603000005_triggers.sql              20260726000001_job_views_count.sql         20261001000001_fix_users_role_escalation.sql
20250603000006_rls_complete.sql          20260726000002_resume_access_log.sql       20261025102650_refix_storage_resume_employer_applicant.sql
20250603000007_storage_resumes.sql       20260727000001_govt_jobs_record_integrity.sql   20261026000001_govt_jobs_verification_integrity.sql
20250603000008_signup_trigger_fix.sql    20260727000002_job_lifecycle_foundation.sql
20250603000009_storage_rls_helpers.sql   20260727000003_job_source_posted_at.sql
20260610000001_govt_jobs_reconcile.sql   20260929000001_application_admin_review_gate.sql
20260611000001_ingest_runs.sql           20260929000002_application_admin_review_rls.sql
20260616000001…0003 (applications_board_reconcile, jobs_job_status, auth_failures)
20260706000001_jobs_status_lifecycle.sql 20260707000001_jobs_provenance.sql
```
(= `ls supabase/migrations | sort`; 34 files.) Option B (CLI, from your machine): `supabase db push --db-url "<staging connection string>"` — the connection string stays on your machine.
The `resumes` bucket is created by migration 07. No migration creates `logos`/`avatars` buckets and no source file uses them, so skip those.
**Do not run `docs/growth/proposed-migrations/*` yet** (see STAGING_TEST_PLAN: only test 11 needs it, and only after you approve it).

## 3. Auth settings (Supabase → Authentication)
- URL Configuration: Site URL = `https://noble-job-git-integration-launch-noble-job.vercel.app`; add the same host (and `/**`) to Redirect URLs.
- The app creates users with the admin API (`email_confirm:false`) and runs its **own** OTP (table `otp_tokens`, emails via Resend). Supabase's built-in email templates are not on the signup path.
- Leave "Confirm email" as default; do not enable third-party OAuth for these tests.

## 4. Email for OTP (choose one)
a) Resend account → API key + `EMAIL_FROM=Noble Job <onboarding@resend.dev>`. Resend's sandbox sender delivers only to the Resend account's own email, so register the test candidate with that exact address.
b) No Resend: registration still succeeds but the OTP email returns `success:false` silently. I can then read the OTP from staging by matching `otp_tokens.otp_hash` (unsalted SHA-256 of the 6-digit code) — only acceptable on staging, see §7 risk note.

## 5. Vercel environment variables (project `noble-job`, as noblejobdelhi@gmail.com)
Add in the **Preview** scope, restricted to the branch **`integration/launch`** (Vercel → Add variable → Environments: Preview → "Select a custom Preview branch" = integration/launch), so other PR Previews do not receive them. Type "Sensitive" for secrets.
| Variable | Preview (staging) | Production |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | staging project URL | **empty until cutover** (production URL only at cutover) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key | production only at cutover |
| `SUPABASE_SERVICE_ROLE_KEY` | **staging** service-role key | **PRODUCTION-ONLY secret; never in Preview** |
| `CRON_SECRET` | random value, staging-only | different random value, Production only |
| `NEXT_PUBLIC_APP_URL` | `https://noble-job-git-integration-launch-noble-job.vercel.app` | `https://www.noblejob.in` at cutover |
| `NEXT_PUBLIC_JOB_DATA_SOURCE` | `supabase` | already set (Production) |
| `SUPABASE_STORAGE_BUCKET_RESUMES` | `resumes` | already set |
| `RESEND_API_KEY`, `EMAIL_FROM` | staging/sandbox values (§4a) — optional | production Resend key at cutover |
| `ADMIN_NOTIFICATION_EMAIL`, `EMAIL_SUPPORT` | optional (your test inbox) | production |
| `RATE_LIMIT_*`, `JOBS_ISR_REVALIDATE_SECONDS`, `HIMALAYAS_*` | optional (already Production) | existing |
| `AI_PROVIDER`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY` | not needed for these tests | per production decision |
**Production-only, never in Preview:** `SUPABASE_SERVICE_ROLE_KEY` (production value), `SUPABASE_DB_PASSWORD`, production `RESEND_API_KEY`, production `CRON_SECRET`, production Supabase URL/anon key.
Note: `NEXT_PUBLIC_*` are baked in at build — after adding variables, **push a new commit** to `integration/launch` (Claude can do an empty commit on request); "Redeploy" would reuse the old build env.

## 5b. Test accounts (SQL Editor on STAGING only)
Create 3 users in Supabase Auth → Users (Add user, "Auto confirm"): `candidate-a`, `employer-a`, `admin-a` with throwaway emails you control (passwords stay with you). Then:
```sql
update public.users set role='admin' where email='<admin-a email>';   -- staging only
```
(Candidate/employer test accounts for registration tests are created by the app itself.) Tell Claude only the **emails** to use, never passwords.

## 6. Verification before tests start (Claude does these)
- Preview loads; the "Login unavailable until authentication is configured" banner is gone.
- POST to `/api/events` with event `register_viewed` → row appears in `analytics_events` (service-role write).
- Vercel Runtime Logs show no Supabase auth/config errors.

## 7. Risks to flag (not fixed here)
- OTP codes are 6 digits stored as unsalted SHA-256 (trivially reversible if `otp_tokens` leaks), and attempt limiting is per-IP via `rateLimit` (in-memory). Test 12 probes brute-force behaviour on staging; any hardening would be a separate PR.
- Staging is public-reachable only behind Vercel deployment protection (SSO) — keep Standard Protection on.
