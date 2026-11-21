# Owner-only Vercel actions for the OLD project `noble-job-g6xn` (account mdsameer119299@gmail.com)

Status: NOT APPLIED. Claude must not change the old project, delete or rotate any credential. These are the exact steps for the owner.

## 1. Stop production credentials reaching feature-branch Previews (decision 2)
Settings → Environment Variables. For each variable below, click ⋯ → Edit → **untick "Preview"** (leave "Production" ticked), Save. Do NOT delete, and do NOT rotate (a rotation would break production).
| Variable | Action | Why |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | full DB access, bypasses RLS — must never exist in a branch Preview |
| `SUPABASE_DB_PASSWORD` | Production only | direct DB credential |
| `RESEND_API_KEY` | Production only | Previews could send real email |
| `CRON_SECRET` | Production only | Previews must not accept the production cron secret |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended: Production only | anon key is public by design, but Previews should not point at the production DB at all |
| `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `NEXT_PUBLIC_APP_URL` | Review | `NEXT_PUBLIC_APP_URL` should not be the production URL on Previews |
Effect: old-project Previews lose DB access and fall back to local inventory/unconfigured mode (the app already supports this). Production is unaffected. Reversible: re-tick Preview.
Also review Team → Settings → Environment Variables (shared vars) and any Integration (Supabase/Resend) that auto-injects variables into Preview.

## 2. Prevent unexpected deploys to noblejob.in during integration (decision 2)
Verified today: Production Branch = `main`, auto-assign custom domains = Enabled, so ANY merge/push to `main` goes live.
**Recommended (A) — move the production branch away from `main`:**
1. GitHub: create branch `legacy-production` at commit `b579044` (the commit currently live) — owner-side, or ask Claude to create it only with your explicit approval.
2. Vercel → noble-job-g6xn → Settings → Environments → Production → Branch Tracking: change `main` → `legacy-production` → Save.
Result: pushes/merges to `main` produce only Previews on the old project; noblejob.in stays on the current deployment (`dpl_6zYFDRub…`) until the owner chooses. No redeploy is triggered by this setting. Rollback: set it back to `main`.
**Optional (B) — also stop old-project Preview builds** (Settings → Build and Deployment → Ignored Build Step → Custom): `exit 0`. This skips every automatic build (production included, so combine with A only if you accept that the old project then builds only when you redeploy manually). A narrower variant that skips only non-main builds is `test "$VERCEL_GIT_COMMIT_REF" != "main"`, but with A in place it is not useful, and **by itself it does not protect production**.
**Not recommended (C):** disconnecting Git — stops all auto-deploys and hides rollback context.

## 3. Verify after you apply (read-only; Claude can do this once you say so)
- Settings → Environments shows Production branch = `legacy-production`.
- Env var list shows Preview unticked for the variables in §1.
- Push a trivial commit to a throwaway branch: the old project's new deployment (if any) has no DB env; `noblejob.in` still serves deployment `dpl_6zYFDRub…`.
- `main` unchanged at `b579044` until cutover.

## 4. NEW project (noblejobdelhi@gmail.com) — same discipline
Preview scope: staging Supabase only. Production scope: empty until the cutover step. Check the Production Branch / Cron Jobs tab so a future merge to `main` cannot start crons against production data unintentionally.
