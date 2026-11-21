# Production cutover plan — noblejob.in (PLAN ONLY — nothing here is approved or executed)

Rule: **no PR is merged into `main` until this plan's Section 0 gates are signed off by the owner.**

## A. What a merge to `main` does TODAY
| | Old project `noble-job-g6xn` (team sameers-projects-2cf742c9) | New project `noble-job` (team NOBLE JOB) |
|---|---|---|
| Production Branch | **`main` (verified read-only)**; auto-assign custom domains ON | **`main` (verified read-only 21 Nov, signed in as noblejobdelhi@gmail.com)**; auto-assign ON |
| Domains | `noblejob.in` (308 → www), `www.noblejob.in`, `noble-job-g6xn.vercel.app` | **only `noble-job.vercel.app`** (no custom domain) |
| Env vars | 9 vars, all Production + Preview, incl. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `RESEND_API_KEY`, `CRON_SECRET` | 11 vars, **Production scope only**, non-secret config (APP_NAME/APP_URL, JOB_DATA_SOURCE, HIMALAYAS_*, RATE_LIMIT_*, JOBS_ISR_*, SUPABASE_STORAGE_BUCKET_*). **No Supabase URL/keys, no CRON_SECRET, no Resend key; no Preview-scoped vars.** |
| Effect of merge to main | Immediate **Production deployment auto-assigned to noblejob.in** → live users get the merged code in ~2 min, on the production DB. | A **Production deployment IS built** at `noble-job.vercel.app` (public URL), **unconfigured** (no DB keys) → app falls back to local inventory / "authentication not configured"; not on noblejob.in. Its Cron Jobs tab lists the vercel.json cron(s); with no `CRON_SECRET`, `main`'s cron routes **fail closed (401)** — verified in code — so no ingestion and no writes. Harmless to data, but it is a public production URL that would show a degraded site; do not treat it as the cutover. |
| Database | Code runs against the live DB. Migrations are NOT auto-applied; code that expects new objects (e.g. `analytics_events` from #61) must be matched by a reviewed, additive migration first. | Same concern for whichever DB its Production env points to. |
| Ignored Build Step on old project (proposal) | Only skips non-main builds. **Does not prevent the main→production deploy.** | n/a |

Also true today: every Preview on the old project carries the production service-role key (see OLD_VERCEL_PROJECT_BUILDS.md).

## B. Safer merge mechanics (proposal — needs owner approval, not done)
Use an **integration branch** (e.g. `integration/launch`) as the base for the stacked PRs instead of `main`. Merging into it creates only Previews (in both projects) and lets CI run (add it to `pr-ci.yml` branches). `main` is touched exactly once, at cutover, via one reviewed merge. Retargeting PRs requires explicit owner approval.

## C. Phases
**0. Gates (owner sign-off)** – staging Supabase tests passed (STAGING_TEST_PLAN.md); Node 24 Preview matrix passed (NODE24_PREVIEW_VERIFICATION_PLAN.md); decision on DB strategy (D); maintenance window chosen; old-project owner available; rollback owner named.

**1. Inventory (read-only)**
- Old project: env vars listed in OLD_VERCEL_PROJECT_BUILDS.md; confirm Cron Jobs tab, Resend domain, Supabase Auth redirect URLs/site URL.
- New project (sign in as noblejobdelhi@gmail.com): Production Branch, Production-scoped env vars, attached domains, Cron Jobs tab, Node setting. Expected end state: **Production scope empty or staging-only until step 4**; Preview scope = staging only.
- DNS: where noblejob.in is hosted (Vercel nameservers vs external registrar), current records, TTL.

**D. Database connection – choose ONE**
1. *Same production Supabase* (recommended for continuity: no data move). New project Production env = same URL/anon/service-role/DB password; Preview = staging project only. Requires additive migrations only, applied manually (SQL reviewed, backup/PITR confirmed first).
2. New Supabase project: needs data migration + auth user migration (passwords/hash export) → high risk, not recommended for launch.
Never put production service-role keys in Preview scope of the new project.

**2. Prepare (no user impact)**
- New project: add Production env vars (copy names from old; values entered by the owner, never by me), `CRON_SECRET`, `NEXT_PUBLIC_APP_URL=https://www.noblejob.in`, Resend vars. Keep Production Branch = `main` but do not attach domains yet.
- Lower DNS TTL (if external DNS) 24–48 h ahead.
- Verify domain ownership for the new team via the TXT record Vercel gives (add-domain flow) — DNS record change = owner action.
- Apply reviewed additive migrations to production in a quiet period; run funnel queries on the empty table.
- Merge order (INTEGRATION_PLAN.md) into the integration branch; re-run Preview + CI matrix on Node 24.

**3. Cutover (≈30 min window)**
1. Freeze: no old-project deployments/merges.
2. Merge integration → `main` (this also builds the old project's production deployment: it will auto-serve noblejob.in from the NEW code on the OLD project unless the old project is first disabled/ignored by its owner. DECIDE in advance: either (a) accept this as a "soft" first step, verify on old prod, then move the domain; or (b) owner sets old project's Production Branch to a placeholder / Ignored Build Step to skip main before the merge so only the new project builds.)
3. Verify the new project's Production deployment on its `*.vercel.app` URL BEFORE moving the domain (Section F, minus domain checks).
4. Domain move: add `noblejob.in` + `www.noblejob.in` to the new project; owner removes them from the old project (or reassigns) in the same step; keep the apex → www 308 redirect and the same canonical host.
5. Crons: ensure exactly one project runs crons — disable old project's cron jobs after cutover; confirm new project's first run by `ingest_runs`.

**4. Rollback (decide triggers: error rate, failed login/OTP, 5xx on key pages, ingestion errors)**
- Fast path (<5 min): move the domains back to the old project (its last good production deployment `dpl_6zYFDRub…`, main `b579044`, is a rollback candidate; do not delete the project for ≥30 days). If step 3(a) was used, use "Rollback" on the old project to that deployment.
- DB: migrations are additive and backward-compatible, so rollback needs no schema revert; keep down-scripts ready; PITR/backup timestamp recorded before step 3.
- Re-enable old crons; disable new crons.
- Communications: owner statement template prepared in advance.

**5. Verification (F)**
Home, /jobs/private, /govt-jobs, a job detail, /for-employers, /auth register + OTP email arrives (Resend/SPF/DKIM unchanged), login, candidate dashboard + completion card, apply flow with resume (PDF + DOCX, 4 MB boundary), employer register + post job (pending approval), admin approval, /sitemap.xml + /robots.txt on the final host, canonical/hreflang, structured data (JobPosting) spot-check, security headers, cron auth (unauthenticated → 401), Vercel logs clean for 30 min, Search Console: sitemap re-fetch, no spike in crawl errors; analytics events appear in `analytics_events`.

**6. Post-cutover (D+1…D+7)**
Daily error/log review; compare registrations/applications to the pre-cutover baseline (admin growth queries); keep old project read-only; only then consider archiving it.

## G. Explicitly NOT done / needs the owner
Any settings change in either Vercel project, any DNS change, any production DB change, merging, retargeting PRs.
