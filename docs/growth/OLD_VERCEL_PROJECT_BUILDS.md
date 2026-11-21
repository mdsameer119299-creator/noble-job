> **SCOPE WARNING — read first.** The Ignored Build Step below ONLY stops duplicate *non-main (Preview)* builds on the old project.
> It does **not** stop, delay or protect a production deployment: a push/merge to `main` still builds and goes live on noblejob.in.
> Protecting production is a separate matter — see `PRODUCTION_CUTOVER_PLAN.md`. Neither is applied; the old project is untouched.

# Unexpected Preview builds on the old Vercel project `noble-job-g6xn` — findings + PROPOSAL (no change made)

## Observed (read-only)
- Old project (`prj_r5aJ8QKyEVkkgV7Jv3DQ4Yor7PWv`, team `sameers-projects-2cf742c9`, serves noblejob.in / www.noblejob.in) is Git-linked to the same repo and builds EVERY pushed branch as a Preview (target null). Recent builds: all our PR branches, creator `mdsameer119299-3242`.
- Both Vercel GitHub integrations post commit statuses (`Vercel – noble-job` and `Vercel – noble-job-g6xn`), so each push builds twice.
- `main`'s own status is the old project's Production build: **merging any PR to main will auto-deploy to noblejob.in** unless the old project is changed first.
- The repo's `vercel.json` only holds crons; there is no `git.deploymentEnabled` / `ignoreCommand`.
- The NOBLE JOB account (`noblejobdelhi@gmail.com`) cannot open the old project (404): its settings can only be changed by the owner of team `sameers-projects-2cf742c9`.

## Verified read-only on 21 Nov 2026 (signed in as mdsameer119299@gmail.com)
- Production Branch = `main`; "Every commit pushed to the main branch will create a Production Deployment"; Auto-Assign Custom Production Domains = Enabled.
- Domains: `noblejob.in` (308 → `www.noblejob.in`), `www.noblejob.in`, `noble-job-g6xn.vercel.app`.
- Git repo `mdsameer119299-creator/noble-job` connected 4 Jun; Ignored Build Step behaviour = **Automatic** (no custom command).
- Latest production deploy: `dpl_6zYFDRub…` from main `b579044` (PR #56), READY, rollback candidate.
- Env vars (all scoped Production **and Preview**): NEXT_PUBLIC_APP_URL, ADMIN_NOTIFICATION_EMAIL, CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD, RESEND_API_KEY, EMAIL_FROM.
  => every Preview built on the old project (all our PR branches) runs with the PRODUCTION Supabase service-role key. That is a second reason to stop those builds, and a reason never to exercise write paths on those Preview URLs.

## Options
1. **Ignored Build Step on the OLD project (recommended, owner-only).** Settings → Build & Deployment → Ignored Build Step → custom command:
   `test "$VERCEL_GIT_COMMIT_REF" != "main"`  (exit 0 = skip build for every non-main branch; main still builds).
   Affects only the old project; the new project is untouched. Reversible by clearing the field.
   Caveat: PRs merged to main still deploy to production there — see 4.
2. Disconnect Git on the old project: stops Preview AND production auto-deploys. Safe only if the old site is to be deployed manually; not recommended while it is live.
3. Repo `vercel.json` `ignoreCommand`/`git.deploymentEnabled`: applies to BOTH projects (same file) — rejected.
4. **Before any merge to main**: decide how main should reach noblejob.in (owner of the old project) — either accept the auto-deploy, or set the old project's production branch / ignored step so the migration cut-over is deliberate.

## Needs from the owner
Apply option 1 (or tell me you prefer another) in the old project's dashboard, or invite `noblejobdelhi@gmail.com` as a viewer/member so I can verify settings read-only. I will not modify the old project.
