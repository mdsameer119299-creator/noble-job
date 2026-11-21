# Supabase + Vercel audit — 21 Nov 2026

Scope: read-only audit of production wiring plus repository-level fixes. **No production environment variable, database, domain or deployment was changed.** No secret values appear in this document (variable *names* only).

## 1. Confirmed production wiring

| Item | Finding | How verified |
|---|---|---|
| Vercel project | `noble-job-g6xn` (team "Sameer's projects"), Next.js, Node 24.x | Vercel API |
| Domains | `noblejob.in` → 308 → `www.noblejob.in`, plus `noble-job-g6xn.vercel.app` | Vercel API |
| Supabase project the live site talks to | `jpdxyysijvqfrwnabenk` | The public client JS bundle served by https://www.noblejob.in contains `jpdxyysijvqfrwnabenk.supabase.co` and no other Supabase host. (All Vercel env values are type *sensitive* and cannot be read back, so this is the only non-invasive proof.) |
| Cron jobs | `/api/cron/govt-jobs` 01:00 UTC, `/api/cron/himalayas` 03:00 UTC; both fail **closed** if `CRON_SECRET` is unset | `vercel.json`, route source |

## 2. Environment variables

Configured on Vercel (all type *sensitive*, scoped **Production + Preview**): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `ADMIN_NOTIFICATION_EMAIL`.

| Variable | Used by | Needed on Vercel? | Note |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | runtime | Prod + Preview | Preview should point at **staging**, not production |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime (admin client) | **Production only** | Currently also in Preview — see risk R1 |
| `SUPABASE_DB_PASSWORD` | `scripts/*` migration tooling only (never the running app) | **No** | Not read by `src/`; remove from Vercel — see risk R2 |
| `CRON_SECRET` | cron routes | Production | Preview crons do not run |
| `RESEND_API_KEY`, `EMAIL_FROM` | email | Production (Preview optional) | |
| `ADMIN_NOTIFICATION_EMAIL` | `adminNotifyService` | Production | Falls back to `ADMIN_EMAIL`, then `EMAIL_SUPPORT` |
| `NEXT_PUBLIC_APP_URL` | links/metadata | Prod + Preview | Different value per environment |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `AI_PROVIDER` | `src/lib/ai/provider.ts` | Optional | Absent on Vercel; AI features degrade if used |
| `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_DB_*` | scripts / GitHub Actions only | No | Not runtime |
| `NEXT_PUBLIC_JOB_DATA_SOURCE` | non-production only | No | Ignored when `NODE_ENV=production` |
| `GOVT_INGEST_BUDGET_MS`, `SEO_MIN_JOBS_GOVT_STATE`, `SITEMAP_SNAPSHOT_LIMIT` | tuning | Optional | Defaults apply |

No duplicate variable names were found. Missing-but-required names: **none** for runtime. `.env.example` is missing `SITEMAP_SNAPSHOT_LIMIT`, `GOVT_INGEST_BUDGET_MS`, `SEO_MIN_JOBS_GOVT_STATE`, `OPENAI_*`, `ANTHROPIC_*`, `AI_PROVIDER` (documentation gap only).

## 3. Runtime errors (Vercel, last 7 days, production project)

| # | Error | Count | Status |
|---|---|---|---|
| 1 | `live query returned an error … TypeError: fetch failed` on `/sitemap.xml` (`getJobs`) | 1,619 (since 24 Oct) | **Not fixed** — network failure reaching Supabase; cause not provable from Vercel alone (see §5) |
| 2 | `invalid input syntax for type uuid: "live-priv-…"` / `"ver-priv-…"` on `/jobs/private/[id]` | ~474 | **Fixed in this PR** |
| 3 | `Page changed from static to dynamic at runtime … reason: cookies` on many `/jobs-in*` ISR pages | 1,000+ across ~45 URLs (Vercel list capped at 50 groups, so a lower bound) | **Fixed in this PR** (needs preview verification) |
| 4 | `/opengraph-image`: "Expected `<div>` to have explicit display: flex" | 209 (since Aug) | Not reproduced on current source — see §4 |

## 4. Fixes in this PR

1. **Non-UUID job ids no longer hit the `jobs` table** (`jobService.getJobById`). `jobs.id` is a uuid; ids like `live-priv-24` can never match and each request produced a Postgres 22P02 error (extra API + Postgres log lines and wasted round trips). They now resolve from the live/local sources exactly as before.
2. **ISR/SEO pages read with a cookie-less anonymous client** (`src/lib/supabase/public.ts`; `getJobs(filter, { cookieless: true })` used by `seo/landing.ts`, `seo/genuineJobs.ts`, `services/visibleCounts.ts`). The cookie-based client calls `cookies()`; Next.js records that as dynamic usage even when the error is swallowed, which throws "static to dynamic" on ISR pages. The anon client carries no session and uses the anon key only, so RLS applies exactly as for a signed-out visitor. **No RLS, auth, or service-role behaviour changed.**
3. Regression tests: `npm run test:jobservice-audit` (fails on the old code, passes on the new).

**Verification performed:** `tsc --noEmit` clean; all 53 `test*` scripts pass; `next build` succeeds (Google Font mocked because the sandbox blocks fonts.googleapis.com). **Not verified:** the ISR fix end-to-end — the sandbox build has no Supabase credentials, so the runtime `cookies()` path was verified by unit test only. Confirm on a Preview deployment against a **staging** database before merging.

`/opengraph-image`: the current source renders successfully locally (235 KB PNG) once the `🏛` emoji is removed; with the emoji, Satori fetches Twemoji from a CDN at request time (blocked in the sandbox, so that exact path was not exercised). The error may predate commit `89ab974` or be CDN-fetch related. Left unchanged — monitor after deploy; removing the emoji would eliminate the external fetch if it recurs.

## 5. Supabase usage and health — NOT verified

The Supabase connector available to this audit only lists a different project (TAPIS KASA), which was deliberately not touched. `jpdxyysijvqfrwnabenk` was **not reachable**, so the following could not be verified and the previously reported figures should be treated as stale until re-read in the dashboard (Settings → Usage): egress 4.69/5 GB, database 39/500 MB, log ingestion 1.87/1 GB. Likewise **not audited**: RLS policies live in the DB, advisor warnings, applied-migration list vs `supabase/migrations/`, storage policies, Auth/SMTP settings.

Code-level contributors to egress/log volume (candidates, unmeasured):
- `getJobs()` reads `select("*")` up to 1,000 rows (including `description`) per call and is invoked by many ISR pages and the sitemap. Narrowing the column list for list/count views would cut transfer, but `mapPrivateJobRow` reads `description`; needs a careful, tested change — not done here.
- Every `fetch failed` / 22P02 error also produces log lines; fix #1 removes ~470/week of the latter.

## 6. Risks needing owner action (none applied)

| ID | Severity | Risk | Recommended action (owner) |
|---|---|---|---|
| R1 | **High** | `SUPABASE_SERVICE_ROLE_KEY` is scoped to **Preview** on the production project, and every pushed branch builds a Preview (10 in the last hours). A Preview build/runtime holds a key that bypasses RLS on the production database. Preview URLs are SSO-protected (mitigation), but code on any branch can read the key. | Remove Preview scope from the service-role key (and point Preview `NEXT_PUBLIC_SUPABASE_*` at staging). |
| R2 | **High** | `SUPABASE_DB_PASSWORD` (direct DB credential) is on Vercel Prod + Preview but is not used by the running app. | Delete from Vercel; keep it only in a local/CI secret store. |
| R3 | Medium | Supabase usage near/over Free limits (egress 94%, logs 187% as last reported) — risk of throttling/restriction. | Re-check dashboard; decide on mitigation (no paid upgrade without approval). |
| R4 | Medium | `main` auto-deploys to `noblejob.in` on the old project. | Owner decision, per cutover plan. |
| R5 | Low | Cron bearer comparison uses `===` (not constant-time); secret is long/random so practical risk is low. | Optional hardening. |
| R6 | Low | `.env.example` incomplete. | Optional docs PR. |

## 7. Staging plan (design only — nothing created)

**Principles:** separate Supabase project and DB; never the production DB; no production secrets copied; Preview builds only ever see staging credentials.

1. **New Supabase project `noble-job-staging`** (own org/project, region `ap-south-1` to match). Free plan allows a limited number of active projects (commonly 2) and pauses after ~1 week of inactivity — **confirm current limits and current project count in the dashboard before creating.** Creating it is free but needs your explicit approval.
2. **Schema:** apply `supabase/migrations/*` in order with `supabase db push --db-url <STAGING-url>` (explicit URL, dry-run first). **Do not use `npm run db:apply`** (it reads the legacy `src/database/migrations`, 11 files, not the 34 canonical ones) and **do not rely on `supabase link`/`config.toml`** (`project_id` there is the *production* ref). `npm run db:seed` is a stub that only lists files and seeds nothing; synthetic data needs a purpose-built staging seed. Full runbook: `docs/STAGING_ENVIRONMENT_PLAN.md`.
3. **Vercel env (Preview scope only):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (staging), `SUPABASE_SERVICE_ROLE_KEY` (staging — a *different* key from production), `NEXT_PUBLIC_APP_URL` (preview URL), `CRON_SECRET` (new random value; crons don't run on Preview), `RESEND_API_KEY` omitted or a Resend test key. Production scope keeps the production values; the production service-role key must **not** have Preview scope.
4. **Auth (staging):** Site URL + redirect allow-list = preview domains; email confirmation stays **on**; use a test mailbox.
5. **Test order:** migrations on empty staging → `npm run verify:rls` / `verify:schema` against staging → deploy PR branch Preview → exercise job pages, sign-up, apply flow.
6. **Cost/resources:** ₹0 on Free plan; staging DB expected < 50 MB, negligible egress.

## 8. Manual actions requiring owner approval

1. Remove Preview scope from `SUPABASE_SERVICE_ROLE_KEY`; delete `SUPABASE_DB_PASSWORD` from Vercel (old project `noble-job-g6xn`).
2. Open Supabase dashboard → Usage and report current egress / DB size / log ingestion; review Advisors (Security + Performance) and Auth → Email settings.
3. Approve creation of the staging Supabase project (free) — or decline.
4. Review/merge this PR only after a Preview check against staging.
