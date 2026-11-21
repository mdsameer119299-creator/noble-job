# Staging Supabase — exact setup checklist

**Who does what:** the owner does steps 1–6 directly in Supabase/Vercel. Claude never receives, requests or handles credentials (no keys/passwords in chat, commits or docs). Claude does not push the build-triggering commit until the owner says so explicitly (step 7).

**Hard rules:** staging project only · every Supabase credential below is the STAGING project's · no production URL/key/DB password anywhere in Preview · no real user data · `main` unchanged · no production DB operations, DNS changes or deployments.

## 0. Scope of migrations (kept separate)
- **The 34 existing migrations** in `supabase/migrations/` are the only SQL needed for testing existing candidate/employer functionality (steps 2).
- **The admin growth RPC** (`docs/growth/proposed-migrations/…admin_growth_summary*.sql`) is a **future optional feature**. It is **not applied, not required, not a blocker**, and is not in `supabase/migrations`. Do not run it. Test #11 is deferred.

## 1. Create the staging project
Supabase → New project "noble-job-staging" (Free plan OK). Store the DB password in your password manager. Do not clone/restore from production.

## 2. Apply the 34 migrations (filename order, stop on first error)
Verified from empty on local Postgres 16 with Supabase-style stubs: 34/34 applied, 0 errors, 33 public tables (real staging may differ slightly). SQL Editor: run each file in `ls supabase/migrations | sort` order; or CLI from your machine: `supabase db push --db-url "<staging connection string>"` (string stays local).
Order: `20250603000001…000009` (initial schema, RLS, indexes, functions, triggers, rls_complete, storage_resumes, signup_trigger_fix, storage_rls_helpers) → `20260610000001`, `20260611000001`, `20260616000001/2/3`, `20260706000001`, `20260707000001`, `20260709000001`, `20260723000001`, `20260724000001`, `20260725000001`, `20260726000001/2`, `20260727000001/2/3` → `20260929000001/2/3`, `20260930000001/2/3`, `20261001000001`, `20261025102650`, `20261026000001`.
`resumes` bucket is created by `20250603000007`. No `logos`/`avatars` buckets are needed (no source references).

## 3. Supabase Auth settings
Site URL = `https://noble-job-git-integration-launch-noble-job.vercel.app`; add that host to Redirect URLs. The app creates users via the admin API and runs its own OTP (table `otp_tokens`, email via Resend), so Supabase's email templates are not on the signup path. No OAuth providers for these tests.

## 4. OTP testing — controlled staging-only methods (no hash cracking)
Resend's sandbox sender `onboarding@resend.dev` delivers **only to the Resend account owner's own email address** (Resend docs); `delivered@resend.dev` is a simulate-only test address with no inbox.
1. Create a Resend account (free) with an inbox you control; API key → Vercel (step 5). `EMAIL_FROM=Noble Job <onboarding@resend.dev>`.
2. **Real OTP delivery flows** use that exact address as the test email: (a) candidate registration verify; (b) forgot-password OTP on the same account.
3. For the **employer registration** OTP flow reuse the same address after you delete the staging candidate user in Supabase Auth → Users + its `users`/`candidates` rows (staging only), or skip OTP completion for employers (create employer-a via Auth "Add user → auto-confirm") and test the rest of the employer flow.
4. **Negative OTP tests need no code reading:** wrong code (400), reuse of a used code, lockout after 5 wrong codes (429), expiry — to test expiry without waiting you may, on STAGING only, run `update otp_tokens set expires_at = now() - interval '1 minute' where email = '<your test email>' and is_used = false;` (a controlled staging edit; never on production).
5. If you later verify your own sending domain in Resend (a DNS change on a domain you own — **not noblejob.in**, and only if you choose), more test inboxes become possible. Optional.
No other method will be used; Claude will not read or reverse `otp_hash` values.

## 5. Vercel environment variables (project `noble-job`, signed in as noblejobdelhi@gmail.com)
**Verified today (read-only):** the new project has NO Preview-scoped variables; its Production scope holds 11 non-secret config vars only. Keep it that way for everything below.
**Branch restriction (confirmed in Vercel docs):** when adding a Preview variable you can apply it to all non-production branches **or select one specific Git branch**; branch-specific values override same-name general Preview values and apply only to deployments of that branch. Therefore: for every row marked "branch-scoped", choose **Environment = Preview → "Select a custom Preview branch" → `integration/launch`**. Do **not** choose "All Preview Branches" for any Supabase/Resend/CRON variable — then no other Preview branch (e.g. #59–#66 PR branches) can receive the staging service-role key. After saving, the variable list must show each one tagged with the branch `integration/launch`; if any row says "Preview" without a branch, delete/redo it. Claude will re-check this read-only before testing.
Mark secrets as **Sensitive** (write-only after saving). Variables only affect deployments built after they are saved.

| # | Variable | Staging value | Public / Secret | Purpose | Scope |
|---|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | staging project URL | **Public** (shipped to browsers) | Supabase API endpoint; also flips app out of "auth not configured" mode | Preview, branch `integration/launch` |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key | **Public** by design (RLS is the protection) | browser/server client with user rights | same |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | **staging** service-role key | **SECRET** — bypasses RLS | server-only admin client: signup, OTP, analytics writes, ingestion | same, **Sensitive** |
| 4 | `CRON_SECRET` | new random 32+ char value (staging-only, not the production one) | **SECRET** | bearer for `/api/cron/*` | same, **Sensitive** |
| 5 | `NEXT_PUBLIC_APP_URL` | `https://noble-job-git-integration-launch-noble-job.vercel.app` | Public | absolute URLs / links in emails | same |
| 6 | `NEXT_PUBLIC_JOB_DATA_SOURCE` | `supabase` | Public | serve jobs from the DB | same |
| 7 | `SUPABASE_STORAGE_BUCKET_RESUMES` | `resumes` | Server config (non-secret) | resume bucket name | same |
| 8 | `RESEND_API_KEY` | your Resend (sandbox) key | **SECRET** | sends OTP emails | same, **Sensitive** |
| 9 | `EMAIL_FROM` | `Noble Job <onboarding@resend.dev>` | Non-secret | from address (sandbox) | same |
| 10 | `ADMIN_NOTIFICATION_EMAIL` | your test inbox (optional) | Non-secret | admin notification target | same |
| — | `SUPABASE_DB_PASSWORD` | **do not add** | SECRET | not needed by the app at runtime | none |
| — | `AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | not needed for these tests | SECRET | AI features | none |
**All Supabase values above come from the staging project only. Production-only (never Preview):** production Supabase URL/anon/service-role/DB password, production Resend key, production `CRON_SECRET`.

## 5b. Test accounts (STAGING SQL editor / Auth dashboard)
Auth → Users → Add user (auto-confirm): `employer-a@…`, `admin-a@…` using inboxes you control (passwords stay with you). Then `update public.users set role='admin' where email='<admin-a email>';` (staging only). Tell Claude only the emails. The candidate test account is created by the app's own registration (step 4.2).

## 6. Checks Claude runs before the tests (read-only until you say go)
Env list: all rows branch-scoped to `integration/launch`, none under "All Preview Branches", none in Production · staging URL host ≠ production host · Preview shows no "authentication not configured" banner (after step 7) · `analytics_events` receives a test event · runtime logs clean.

## 7. Build-triggering commit — ONLY on your explicit instruction
After you finish steps 1–6, tell me "go". I will then push one empty commit to `integration/launch` (no file changes) so Vercel rebuilds with the new variables, wait for CI + Preview, and run the tests. I will not create that commit before you say so.

## 8. Final pre-flight checklist (owner)
☐ staging project created ☐ 34 migrations applied without error ☐ resumes bucket exists ☐ Auth Site URL/redirects set ☐ Resend account + key ☐ variables 1–10 added, each tagged `integration/launch`, secrets Sensitive ☐ no staging variable under "All Preview Branches" ☐ no production credential anywhere in Preview ☐ employer-a / admin-a created, admin role set ☐ then tell Claude "go".
