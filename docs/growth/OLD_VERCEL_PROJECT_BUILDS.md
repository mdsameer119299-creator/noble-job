# Unexpected Preview builds on the old Vercel project `noble-job-g6xn` — findings + PROPOSAL (no change made)

## Observed (read-only)
- Old project (`prj_r5aJ8QKyEVkkgV7Jv3DQ4Yor7PWv`, team `sameers-projects-2cf742c9`, serves noblejob.in / www.noblejob.in) is Git-linked to the same repo and builds EVERY pushed branch as a Preview (target null). Recent builds: all our PR branches, creator `mdsameer119299-3242`.
- Both Vercel GitHub integrations post commit statuses (`Vercel – noble-job` and `Vercel – noble-job-g6xn`), so each push builds twice.
- `main`'s own status is the old project's Production build: **merging any PR to main will auto-deploy to noblejob.in** unless the old project is changed first.
- The repo's `vercel.json` only holds crons; there is no `git.deploymentEnabled` / `ignoreCommand`.
- The NOBLE JOB account (`noblejobdelhi@gmail.com`) cannot open the old project (404): its settings can only be changed by the owner of team `sameers-projects-2cf742c9`.

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
