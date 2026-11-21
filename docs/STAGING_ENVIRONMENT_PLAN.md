# Noble Job — staging environment plan (proposal only; nothing created)

Status: **design for owner approval.** No project, database, migration, env var, domain or deployment has been created or changed. Variable *names* only — no secret values.

## 0. Environments and accounts

| Environment | Vercel account / team | Project | Supabase | Status |
|---|---|---|---|---|
| **Production (reference)** | `mdsameer119299@gmail.com` / "Sameer's projects" | `noble-job-g6xn` (`noblejob.in`) | `jpdxyysijvqfrwnabenk` (Mumbai, Free) | Live. Do not touch. |
| New project (future prod candidate) | `noblejobdelhi@gmail.com` / team NOBLE JOB (Hobby) | `noble-job` → `noble-job.vercel.app`, Git = `mdsameer119299-creator/noble-job`, prod branch `main` | none configured (11 Production-only config vars, **no Supabase/secret vars**) | Exists. Not production until owner approves cutover. |
| **Staging (proposed)** | `noblejobdelhi@gmail.com` / NOBLE JOB | **new** `noble-job-staging` | **new** `noble-job-staging` | Not created |

## 1. Vercel staging project (proposed)

- **Separate project, same team, same repo.** Hobby has **no custom environments** (Pro, $50/5), so staging is a second *project*, not an environment. Blast radius is isolated from the future production project.
- **Production Branch = `integration/launch`** (the already-approved integration branch). Alternative: a new dedicated `staging` branch. Never `main`. Because this project's "Production" is staging, it is also what `NODE_ENV=production` runs, so behaviour matches production (no local-inventory fallback).
- Node 24.x. Vercel Authentication (Standard Protection) **on**; no custom domain.
- Crons (`vercel.json`) run only on a project's Production deployment, i.e. on staging. Leave `CRON_SECRET` unset initially: the routes fail **closed** (401), so staging never ingests unattended. Trigger manually with a throw-away secret when testing ingestion.
- Hobby is limited to non-commercial use under Vercel's terms and 1 daily cron per job — fine for staging; **flag for the production decision** (employer monetisation is planned).

## 2. Supabase staging project (proposed)

Requirements (owner action — owner enters all secrets):
1. New project `noble-job-staging`, region `ap-south-1`, Free plan. **Check first:** Free-plan active-project limit and how many active projects that Supabase account already has (not verifiable from here); free projects pause after inactivity.
2. Postgres major version: `supabase/config.toml` says 15 — confirm production's version and choose the same if selectable.
3. Credentials needed (store in a password manager, then paste into Vercel yourself): project URL, anon/publishable key, service-role key, DB password (migrations only, never on Vercel).
4. Auth: Site URL + redirect allow-list = the staging URL only; **email confirmation stays ON**; separate test mailbox (plus-addressing). Supabase built-in SMTP is heavily rate-limited — for sign-up/OTP tests use a separate Resend key/test sender, never the production key.
5. Storage: `resumes` bucket comes from migration `20250603000007`; `logos`/`avatars` (names in `.env.example`) are **not** found in migrations — confirm whether production created them manually, then replicate deliberately.

### Staging environment variables (names; Production+Preview scope of the *staging* project only)
| Name | Staging value source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging project |
| `SUPABASE_SERVICE_ROLE_KEY` | **staging** project key (never the production key) |
| `NEXT_PUBLIC_APP_URL` | `https://noble-job-staging.vercel.app` (or assigned URL) |
| `NEXT_PUBLIC_APP_NAME`, `HIMALAYAS_API_BASE`, `HIMALAYAS_CACHE_TTL_SECONDS`, `JOBS_ISR_REVALIDATE_SECONDS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `SUPABASE_STORAGE_BUCKET_RESUMES/_LOGOS/_AVATARS` | same non-secret values as the new `noble-job` project |
| `RESEND_API_KEY`, `EMAIL_FROM` | separate test key / test sender (or omit) |
| `ADMIN_NOTIFICATION_EMAIL` | test mailbox |
| `CRON_SECRET` | unset (crons fail closed) |
| **Never set:** `SUPABASE_DB_PASSWORD`, any production key | |

## 3. Migration validation plan

Hazards found in the repo:
- `npm run db:apply` uses legacy `src/database/migrations` (11 files) — **do not use**.
- `supabase/config.toml` `project_id = "jpdxyysijvqfrwnabenk"` is **production**; `supabase link`/`db push` without an explicit staging target could hit production. Always pass `--db-url "$STAGING_DB_URL"`, and print the target host before running.
- `docs/MIGRATION_HISTORY.md`: production has 9 history rows holding rollback text, lacks `20261026000001` (pending), and lacks the `synthetic_jobs_visible` admin setting. A from-empty staging therefore will **not** be byte-identical to production.

Steps (after approval):
1. Empty staging → `supabase db push --dry-run --db-url <staging>` → review → apply all 34 migrations.
2. Schema parity: compare staging catalogs to production **read-only** (owner-run `pg_dump --schema-only` of both, or the repo's `supabase/rehearsal/live-history-inventory.json`); document expected diffs (the three items above).
3. Run against staging only (separate `.env.staging.local`, never production's `.env.local`): `verify:schema`, `verify:rls`, `verify:storage`, `verify:rbac`, `verify:signup`. Add a guard that refuses to run when the URL contains `jpdxyysijvqfrwnabenk` (follow-up PR).
4. Apply/validate `20261026000001` on staging first — it is the safe rehearsal for production.
5. Seed `admin_settings.synthetic_jobs_visible='false'` on staging and confirm the fail-closed behaviour.

## 4. Synthetic test data

`npm run db:seed` seeds nothing (prints file names). Write a staging-only seed (`supabase/staging-seed/`, never run on production): ~10 clearly fake employers/jobs per board (private/WFH/abroad/govt) with `example.com`/`.test` contacts, one admin + one employer + one candidate test user (`RBAC_TEST_*` in a local env file only), a few applications to exercise the admin review gate, and **no real people's data or production rows**.

## 5. Staging test plan for PR #69 (docs + 2 code fixes)

1. Merge PR #69 into `integration/launch` **only after owner approval** (never `main`); or point a Preview of the PR branch at the staging project.
2. Confirm: `/jobs/private/live-priv-1` → 404 with **no** new `invalid input syntax for type uuid` log; `/jobs/private/<real-uuid>` → renders.
3. Hit ISR pages (`/jobs-in/<city>`, `/jobs-in-pune/<category>`) repeatedly across a revalidation window; confirm **no** "static to dynamic … cookies" runtime errors (`get_runtime_errors`).
4. Regression: sign-in, apply flow, admin review gate, employer dashboard (cookie-based paths are untouched).
5. Compare Supabase staging log/egress volume before vs after.
6. Rollback: revert the merge commit on `integration/launch`; production untouched throughout.

## 6. Isolating production secrets (old project `noble-job-g6xn`) — NOT applied

Current: all nine variables are scoped Production **+ Preview**.

| Variable | Change | Why |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | remove **Preview** scope | bypasses RLS on production |
| `SUPABASE_DB_PASSWORD` | **delete** | not read by the running app (scripts only) |
| `RESEND_API_KEY` | remove Preview scope | lets previews send real email |
| `CRON_SECRET` | remove Preview scope | not needed on previews |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | remove Preview scope (or repoint to staging) | previews should not default to production DB |
| `ADMIN_NOTIFICATION_EMAIL`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` | leave | harmless / needed |

Side effect to expect: Previews on the old project will build/run without DB config (local-inventory fallback) — intended. Because values are *sensitive* and cannot be read back, scope edits (edit → untick Preview) preserve the stored value; **do not delete and re-add** these. Also decide whether `main` should keep auto-deploying to `noblejob.in`.
