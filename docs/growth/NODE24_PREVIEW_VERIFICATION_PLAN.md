# Node 24 Preview verification plan (run AFTER #58 is integrated; nothing here is done yet)

Why: `engines.node ">=20"` makes Vercel build on the newest Node (Previews showed 26.x). #58 pins `24.x`. Previews built before #58 landed (#59–#66, #61, #63…) are on Node 26 and prove nothing about Node 24.

## 1. Pin lands
- [ ] #58 merged (owner-approved). Confirm `package.json` on the target branch has `"node": "24.x"`.
- [ ] New project NOBLE JOB → Settings → Node.js Version = 24.x (informational; engines wins).

## 2. Rebuild every affected Preview
Branches that must pick up the pin: `fix/security-performance-remediation`(#55), #57, #63, #59, #60, #61, #62, #64, #65, #66.
For each: update from the new base (merge, not rewrite) → push → wait for Preview Ready. (Redeploy button on an old deployment reuses the OLD commit/engines — do not use it.)

## 3. Per-Preview checks (record PASS / FAIL / NOT TESTED)
| Check | How |
|---|---|
| Node version is 24.x | Deployment → Build Logs first lines ("Node.js version 24.x") — and `Runtime Settings` |
| Build succeeds, no new warnings | build log |
| CI `verify` (typecheck, all `test:*`, build) | GitHub check on the head SHA; for stacked PRs use `gh workflow run pr-ci.yml --ref <branch>` |
| PDF scoring on Node 24 (#55/#57/#63 only) | valid PDF → 200 score; invalid PDF → 4xx JSON; malformed → 422 JSON; 4 MB PDF OK; >4 MB → `file_too_large` JSON; DOCX OK |
| Pages render | `/`, `/for-employers`, `/auth?tab=register`, `/jobs/private`, a govt job detail, `/sitemap.xml` (200, valid XML) |
| Runtime errors | Vercel → Logs filtered by deployment: no 5xx / uncaught during the above |
| Cron routes unchanged (#64) | unauthenticated GET → 401; never trigger with a real secret on Preview |

## 4. Exit criteria
All Previews on 24.x, all checks PASS, PDF matrix PASS on 24.x, no runtime errors. Anything NOT TESTED (auth/OTP, analytics persistence, dashboard card) stays listed until staging Supabase exists.
