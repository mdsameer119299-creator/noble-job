# Admin Panel & Workflows — Production Audit

Branch: `fix/admin-production-audit` (from `main` @ `d30ffbf`, which includes PR #27).
Scope: evidence-based audit and fixes for the Admin Panel and related workflows.
Every issue below cites the file/line evidence it was found in; nothing here is a
speculative fix and no fake data was introduced.

Legend — **Status:** ✅ fixed in this PR · 🟡 audited, small fix included ·
🔍 audited, needs runtime/production evidence to fix safely (documented, not faked).

---

## 1. Settings ✅

**Confirmed issue.** `src/components/admin/SettingsForm.tsx` was a **permanent
placeholder** rendering only "Loading settings…" and ignoring its props. There
was **no admin GET** for settings (the GET handler had no `settings` branch → 404),
and the write path was broken.

**Root causes.**
- Placeholder component never wired to any API.
- `siteContentService.updateAdminSetting` used `.update({value}).eq("key", key)`
  on the **cookie (RLS) client**. `admin_settings` is **not seeded** (schema
  `20250603000001`, unlike `site_content`), so an UPDATE-by-key matched **zero
  rows** and nothing ever persisted.

**Fix.**
- New `GET /api/admin/settings` returns `getAdminSettings()`.
- `updateAdminSetting` now uses `supabaseAdmin` (service role) + **UPSERT** and
  returns the DB `error`.
- `PUT /api/admin/settings` validates the body (`validateKeyValueBody`) and
  returns the real DB error instead of a blind `{success:true}`.
- `SettingsForm.tsx` is now a functional generic key/value editor (admin_settings
  has no fixed schema / no code consumers, so a generic editor is the honest
  choice — no invented business settings) with loading / error / empty / saving /
  saved states and client + server validation.

**Tests.** `adminValidation.test.ts`, `adminRoute.test.ts` (upsert + validation +
UI-not-placeholder guards). **Migration impact.** None — `admin_settings` already
exists; UPSERT works against it. **Remaining production verification.** Confirm an
admin can save a setting and it persists across reload on production.

## 2. Site Content ✅

**Confirmed issue.** `ContentEditor.tsx` was a permanent placeholder; no admin GET;
`updateSiteContent` used cookie-client `.update()` (would no-op for any not-yet-seeded key).

**Fix.** `GET /api/admin/content` (`getSiteContent()`); `updateSiteContent` →
`supabaseAdmin` + **UPSERT** + error return; `PUT /api/admin/content` validates &
surfaces errors; `ContentEditor.tsx` is a functional editor over the **7 seeded
keys** (`sitename, tagline, hero_text, contact_email, contact_phone, address,
ncc_banner`) with email validation and all states. **Migration impact.** None.
`updated_at` is maintained by the existing `update_updated_at_column()` trigger
(migration `20250603000005`), so the payload omits it. **Remaining prod verify.**
Save each field; confirm persistence.

## 3. Messages ✅

**Confirmed issue.** `MessageViewModal.tsx` (the entire admin messages UI) was a
permanent placeholder. The GET returned **all** `contact_messages` (unbounded,
`data || []` hiding errors) and there was **no endpoint to mark a message read** —
so unread/read semantics were inert despite `contact_messages.status` existing.

**Fix.** Functional list + detail UI with a status filter and pagination; opening
an unread message calls the new `PATCH /api/admin/messages/{id}/read`
(`status → 'read'`, never downgrading a `replied` row); GET is paginated
(`limit/offset` + `total`) and surfaces DB errors. **Migration impact.** None —
uses existing `contact_messages.status` (`unread/read/replied`). **Remaining prod
verify.** Mark-read persists; unread badge decrements.

## 4. Approvals + Employer Approval ✅

**Confirmed issues** (`adminService.ts`):
- `approveJob`/`rejectJob` awaited the DB update but **notified the employer
  (in-app + email) and admins regardless of `result.error`** → notifications sent
  after failed mutations.
- `rejectJob` set `status='rejected'` only; the dashboard Live/Verified/Total cards
  read `job_status` (`getHybridJobCounts`), which stayed `LIVE_JOB`, so **rejected
  jobs remained in the live/total counts** (misleading counts).
- The route returned `{success:true}` for approve/reject regardless of the result.

**Fix.**
- Both functions **return early on `result.error`** (no notifications after a
  failed mutation).
- `rejectJob` additionally archives `job_status='ARCHIVED_JOB'` — **resilient/best-
  effort** so it never fails the rejection in environments where the `job_status`
  column isn't present (see §10 re: not assuming migrations are applied).
- The route now returns the real success/failure from the service result.

**Status semantics defined** (see §10). **Tests.** `adminRoute.test.ts` asserts
the early-return-on-error guard and the archive. **Migration impact.** None
required; the archive step degrades gracefully if `job_status` is absent.
**Remaining prod verify.** Reject a job → it leaves the Live/Total cards; force a
failing update → no email/notification is sent.

## 5. Applications 🔍/🟡

**Audited.** The candidate→apply→DB path (`applicationService.ts`,
`/api/applications`) inserts into `applications` with `candidate_id`, `job_id`,
`board`, and reads back per-candidate lists ordered by `applied_at`. Admin/employer
visibility is via `/api/admin/applications` and the employer route. The admin
applications list previously had a hard `limit(200)` with in-memory search.

**Fixes in this PR.** `/api/admin/applications` now has real pagination
(`limit/offset` + `total`), surfaces DB errors, and keeps the safe in-memory search
(no user input is interpolated into a PostgREST filter — consistent with the
project's prior injection fix).

**Not changed (no repo-evidence bug).** Duplicate-prevention, FK integrity and RLS
for the insert path are enforced at the DB layer; I found no static evidence of a
broken insert. Verifying end-to-end apply→visibility requires a live candidate
session + DB and is listed under remaining production verification. **No fake
applications were created.**

## 6. Resume Bank 🟡

**Confirmed issue.** In `/api/candidate` resume upload, the storage upload error is
checked, but the subsequent `candidates.update({resume_url})` **ignored its error**
and the "resume uploaded" admin alert fired regardless — a failed link leaves an
**orphaned upload** (in storage but `resume_url` null), invisible to the admin
resume bank.

**Fix.** The `resume_url` update error is now surfaced (500) and the admin alert is
**not** sent after a failed link. Upload already validates type/size
(`validateResumeFile`) and stores under a per-candidate path; admin access is via a
short-TTL **signed URL** (`resolveResumeSignedUrl`) behind `requireAdminApi` (never
public). **Migration impact.** None. **Remaining prod verify.** Upload a resume →
admin resume bank shows it and the signed URL opens; resumes stay private.

## 7. Candidate Data 🔍

**Audited.** Registration/profile updates flow through DB triggers
(`20250603000005`: `on_auth_user_created`, candidate/employer provisioning,
`recalculate_profile_score_trigger`). The admin candidate list/detail reads
`candidates … users(email,status,created_at)`. Search is now supported (in-memory,
safe) and paginated. Missing names/categories, when present, reflect **real** empty
profile fields — **not fabricated**; the admin UI shows them as-is. No static
evidence of an ID-model bug was found (candidate.user_id → users.id is consistent
across services). **Remaining prod verify.** Confirm profile-score recompute + name/
category display on real accounts.

## 8. Government Job Ingestion 🔍

**Audited.** There is a real ingestion pipeline: `govtAutoUpdate.ts` (fetch → parse
→ upsert → expire → **records `ingest_runs`**), adapters under `src/lib/ingest/
adapters/` (`ibps.ts`, `stateListSources.ts`, …) and config in
`src/lib/config/govtSources.ts`. Error tracking already exists (`ingest_runs`
insert with logged failures).

**Concrete static finding (build evidence).** `next build` reports
`Module not found: Can't resolve 'playwright'` in
`src/lib/ingest/adapters/rpscPlaywright.ts` — and **`playwright` is not in
`package.json`**. So any source routed through the Playwright adapter cannot load
its scraper at build/runtime and will fail. This is a **real, pre-existing** bug
(ingest code is untouched by this PR). It is **not** fixed here on purpose: adding
Playwright (browser binaries, large deploy footprint) or refactoring the adapter is
a deliberate decision that needs runtime evidence of *which* sources actually route
through it (`rpsc` = Rajasthan is not in the reported failed set), and installing a
heavy dep speculatively would be exactly the kind of unfounded change the brief
forbids.

**Still requires runtime evidence.** Tracing why the specific reported sources
(`ibps`, `drdo-rac`, `ai`, `hpsc`, `gpsc`, `tnpsc`) fail requires **executing the
adapters against the live government sites** (network + HTML/endpoint shape at run
time) and reading the `ingest_runs` rows — not determinable from static repo
evidence alone. Per the brief, I have **not** marked any failed source healthy.
**Recommended next step (separate, runtime-gated task):** run ingestion per source,
capture the actual failure (missing playwright / timeout / selector drift / blocked
UA / cert), then fix the specific adapter/config/retry with evidence.

## 9. Admin API + Performance ✅

**Confirmed issues** (`/api/admin/[[...params]]/route.ts`):
- **DB errors hidden as empty arrays** — `pending-jobs, jobs, employers,
  candidates, messages, govt-jobs, abroad-jobs, application-counts` destructured
  only `data` and returned `{data: data || []}`.
- **`success:true` after failed/unknown mutations** — `PUT`, `PATCH`, `DELETE` all
  ended with `return NextResponse.json({success:true})`; `POST approve/reject`
  returned success without checking the result.
- **Unbounded `application-counts`** — full-table `select("job_id")`, no bound.
- **No pagination** on large lists; **no body validation**.

**Fixes.**
- Every list GET checks `error` → **500** (`dbError`); never a silent empty array.
- Unknown routes on every verb → **404** (`notFound`); mutations return the real
  DB success/failure.
- `application-counts` is bounded: `?jobIds=uuid,uuid` → exact `.in(...)` tally;
  otherwise a bounded recent window (`ADMIN_LIST_MAX_LIMIT`) — never a full scan.
- Server-side **pagination** (`limit`/`offset`, capped at 500) + `total` on jobs,
  candidates, employers, messages, applications; safe in-memory search where
  applicable.
- **Body validation** (`validateKeyValueBody`) for settings/content; UUID
  validation of path ids before any mutation.

**Tests.** `adminValidation.test.ts` (10) + `adminRoute.test.ts` (8). **Migration
impact.** None.

## 10. Database / Status Architecture ✅ (partial)

**Model (confirmed from migrations).**
- `jobs.status` — lifecycle: `draft, pending, active, paused, rejected, closed,
  archived` (`20260706000001`). `active` == approved/live.
- `jobs.job_status` — inventory bucket for dashboard cards: `LIVE_JOB,
  VERIFIED_JOB, ARCHIVED_JOB`, default `LIVE_JOB` (`20260616000002`; the migration
  itself notes "production never received it" — so readers must be resilient).
- `is_verified` — legacy trust flag; `getHybridJobCounts` falls back to it when
  `job_status` is unavailable.

**PR #27 verified.** `adminService.getAdminStats` derives `totalJobs` from the
`job_status` buckets (matching the admin inventory view) with an `is_verified`
fallback — this is coherent and retained.

**Remaining inconsistency fixed.** `rejectJob` now moves `job_status → ARCHIVED_JOB`
so a rejected job leaves the Live/Total cards, keeping the two axes consistent.
This is done **best-effort** and never assumes the `job_status` migration is applied
in a given environment (Vercel deploying the app does **not** imply Supabase
migrations ran). **Known edge case (documented, not fixed):** re-approving a
previously-rejected job leaves `job_status=ARCHIVED_JOB` until an admin reclassifies
it via the existing job-status toggle — approve intentionally does **not** clobber a
`VERIFIED_JOB`'s bucket.

**Remaining prod verify.** Confirm on production whether `jobs.job_status` exists;
if not, the app already degrades to `is_verified` and the reject archive is a safe
no-op.

---

## Test / build commands (actual repo scripts)
`npm ci` · `npm run lint` · `npm run type-check` · `npm run test:admin` ·
`npm run test:admin-route` · (+ existing `test:provenance/acq/resume/resume-workspace/egress`) · `npm run build`.

## Files changed
- `src/app/api/admin/[[...params]]/route.ts` — API hardening (§1,2,3,4,9,10)
- `src/lib/services/siteContentService.ts` — upsert + service role + errors (§1,2)
- `src/lib/services/adminService.ts` — approve/reject notify-on-success + archive (§4,10)
- `src/app/api/candidate/[[...params]]/route.ts` — resume_url persistence error (§6)
- `src/components/admin/{SettingsForm,ContentEditor,MessageViewModal}.tsx` — functional UIs (§1,2,3)
- `src/lib/validation/adminValidation.ts` (+ test) — pure validators (§9)
- `src/app/api/admin/adminRoute.test.ts` — source-level regression guards
- `package.json`, `.github/workflows/pr-ci.yml` — wire the two new test suites

## Migrations added
**None.** All fixes work against the existing schema; no destructive DB operations.

## Remaining production-only verification (summary)
Settings/Content save & persist · Messages mark-read persists · Reject removes a job
from Live/Total · resume upload → admin signed-URL access · apply→visibility
end-to-end · govt-ingestion runtime failure tracing (§8, separate runtime task).
