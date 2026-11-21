# Staging Supabase test plan (nothing here has run; needs a STAGING Supabase project created by the owner)

Principles: staging keys only (anon + service-role of the staging project) in the new project's **Preview** scope; never production keys. No real user data; synthetic accounts only.

## Setup (owner)
1. Create Supabase project "noble-job-staging". 2. Apply `src/database/schema.sql` + migrations in order (including `analytics_events`). 3. Auth: enable email OTP, set Site URL / redirect URLs to the Preview alias; configure SMTP/Resend sandbox sender. 4. Add env vars to Preview scope: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (staging value), RESEND/EMAIL_FROM sandbox. 5. Redeploy the Previews (new commit, not Redeploy).

## Tests (record PASS/FAIL/NOT TESTED with evidence)
| # | Area | Test | Pass criteria |
|---|---|---|---|
| 1 | Analytics persistence (#61) | load /auth?tab=register, submit, verify; check `analytics_events` | rows for register_viewed/submitted/verified with expected props; unknown event names rejected; no PII in props |
| 2 | Funnel SQL (#62) | run `funnel-queries.sql` + `admin-dashboard-queries.sql` on staging | no errors; counts match seeded fixtures; EXPLAIN shows acceptable plans |
| 3 | Registration (#65) | name+email+password only → OTP email → verify | `candidates` row created with only those fields; category/experience nullable OK; wrong/expired OTP rejected; duplicate email message |
| 4 | Profile completion | dashboard card → Step2 save → completes | PUT whitelist enforced (extra fields ignored/rejected); `profile_score` trigger updates; PROFILE_COMPLETED event stored |
| 5 | Restricted features | incomplete profile: apply without resume blocked; recommendations tolerate null category | as designed; no 500s |
| 6 | Mass-assignment | PUT with role/id/email/verified fields | 400 or ignored; DB unchanged |
| 7 | RLS | employer A cannot read candidate B who did not apply | 0 rows |
| 8 | Resume limits (#63) | stored resume >4 MB → `file_too_large` JSON + UI notice; ≤4 MB OK | existing file not deleted |
| 9 | Employer flow | register → post job → status pending → admin approve → visible | `jobs.status` transitions; manual approval enforced |
| 10 | Cron/ingestion (#64) | call cron routes with/without bearer | 401 without; with staging secret writes `ingest_runs`; idempotent on re-run |
| 11 | Admin dashboard RPC (plan) | execute as anon/auth/service | anon/auth denied; service OK |
| 12 | Auth hardening | rate limits, session cookies, logout | as per existing security tests |

Exit: all PASS or documented waivers → Gate in PRODUCTION_CUTOVER_PLAN.md §C.0.

## Update (21 Nov, v2 — owner adjustments)
- **11 required tests + 1 deferred.** #11 (admin growth RPC) is a future OPTIONAL feature: not applied, not a blocker, no staging run. Testing of existing candidate/employer functionality needs **no new migration** — only the 34 existing ones.
- Objects used already exist: `analytics_events` (RLS on, no policies = service-role only), nullable `candidates.category/experience_years/phone`, `profile_score` trigger (verified locally: 0 at signup, 15 after completion), `auth_failures` lockout table.
- **OTP (#3, #12):** controlled methods only — Resend sandbox to the owner's own address, wrong-code/lockout/reuse tests, staging-only `expires_at` edit for expiry. No hash recovery. See STAGING_SETUP.md §4.
- #12 also checks: failed/unauthorised operations return clean 4xx (no stack traces/secrets), runtime logs reviewed per failure, lockout behaviour under concurrent wrong guesses (observation only; hardening is the separate proposal).
