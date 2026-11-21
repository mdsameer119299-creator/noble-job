# Candidate journey without OTP: browse, upload, score — proposal (DOCS ONLY)

Status: **proposal, nothing implemented.** No code, migration, env var, deployment or production change is made by this document. Separate from PR #67 (OTP security hardening). The SQL under `proposed-migrations/` is **not applied anywhere**; it was run only against a throwaway local Postgres to check it is valid and additive.

## 1. Product decision

A candidate must **not** need OTP/e-mail verification to (1) browse jobs, (2) upload a PDF/DOCX resume, (3) get a basic resume score. An account is optional until the candidate wants to save things; an account **and a verified e-mail** are needed to apply.

| Step | Account | OTP / verified e-mail |
|---|---|---|
| Browse / search / view jobs | No | No |
| Upload resume + basic score | No | No |
| Save resume & jobs, track | Yes (password) | No |
| Apply to a job | Yes | **Yes** |
| Password reset, e-mail change | Yes | Yes (OTP is the proof of mailbox ownership) |

Why OTP at *apply*: an application is the first action that sends a candidate's data to a third party (employer, after admin approval) and creates an identity employers rely on. Verified e-mail there prevents typo/squatted addresses and fake applicants; nothing earlier carries that risk.

## 2. What exists today (review findings)

1. **Browse**: job pages and `/api/jobs` are public. Only `/admin`, `/employer`, `/candidate` are protected by middleware (role cookie check).
2. **Anonymous score already exists**: `POST /api/resume/quick-score` is public, parse-first, **persists nothing**: `readBodyLimited`, `validateResumeFile`, `hasValidResumeSignature`, bounded `extractResumeText`, heuristic `analyzeResume`; rate limit 5 / 10 min per client, 600 / h global via `distributedRateLimit` (durable, cross-instance, **fails open** when the DB is unavailable). Returns score, ATS score, ≤12 skills, ≤5 suggestions. Used by `ResumeUploadWidget` and `ImproveFlow`. **Requirement 2 and 3 are therefore largely met today; the gap is that the result and file are lost on navigation, so there is nothing to "save".**
3. **Stored resume** (`POST /api/candidate/resume`): needs a session; uploads to private bucket `resumes` at `{candidateId}/resume.{ext}` with `upsert:true`; uses unbounded `req.formData()` and only `validateResumeFile` (no signature check, no body cap before parse). Bucket limit in the migration is 5 MB vs 4 MB in the app.
4. **Storage RLS**: candidates own `{auth.uid()-linked candidate id}/…`; employers only if verified **and** application `admin_review_status IN ('approved','shared')` (migration `20261025102650`). No anonymous access exists, which is the right default.
5. **Registration/auth**: `registerCandidate` creates the Supabase user with `email_confirm:false`; `verify-otp` (`email_verify`) sets `users.email_verified=true, status='active'` and confirms the auth user. Only the service role can change `role/status/email_verified` (migration `20261001000001`). Login is `signInWithPassword`; the login handler itself does **not** check `email_verified`. **To confirm on staging:** whether Supabase rejects sign-in for an unconfirmed e-mail in the project's Auth settings (likely, in which case OTP is currently a hard gate before any session).
6. **Apply** (`POST /api/applications`): needs a session and `candidates.resume_url`; does **not** check `email_verified`. Gov jobs are external-only. Applications start `admin_review_status='pending_review'`.
7. **Saved jobs** (`/api/saved-jobs`) and bookmarks: session required (401 otherwise).
8. `analytics_events`, `auth_failures`: RLS on, no policy (service-role only). Same pattern is reused below.

## 3. Proposed architecture

### 3.1 Anonymous resume, "private temporary storage + claim token"

Two options were weighed:

- **A. No persistence (today).** Score in memory; nothing to delete or abuse; but nothing to save after signup, and the candidate must re-upload.
- **B. Opt-in temporary storage (recommended).** Persist **only when the candidate chooses "Save my resume"** (checkbox/button after the score is shown, with consent copy). The default stays A, so a casual score never stores a file.

For B:

- New private bucket `resume-temp` with **no storage policies at all**, so `anon`/`authenticated` can never read or write; only server routes using the service role can.
- Table `anonymous_resumes` (RLS on, no policy → service-role only): `claim_hash`, random `object_path` (`<uuid>.<ext>`, never from user data), `ext`, `size_bytes`, `sha256`, `score`, `client_hash` (HMAC of IP, no raw IP), `expires_at` (default now+24 h), `claimed_by`, `claimed_at`. See `proposed-migrations/20261121000002_anonymous_resumes.sql`.
- **Claim token**: 32 random bytes returned once and stored in an `HttpOnly; Secure; SameSite=Lax; Path=/api` cookie (`nj_resume_claim`, max-age 24 h). Only `HMAC(pepper, token)` is stored. The token is never put in a URL, so it cannot leak via referrers, logs or shared links.
- API (new, server-only):
  - `POST /api/resume/anonymous` : same pipeline as quick-score (bounded body, signature, parse) **plus** stores the file, sets the cookie, returns the score. Stricter limit (e.g. 3 stored uploads / h per client, 200 / day global) and a cap of **1 live unclaimed resume per `client_hash`** (new upload replaces the old and deletes its object).
  - `GET /api/resume/anonymous/status` : whether a live claim exists (no file content).
  - `DELETE /api/resume/anonymous` : candidate deletes it now (privacy control; also clears the cookie).
  - No download endpoint for anonymous files. Nothing but the claim step ever reads the object.

### 3.2 Secure linking to a new account

Claim is performed **server-side at an authenticated step**, never by the browser holding a path:

1. Candidate registers (or logs in). Registration does not need OTP.
2. Authenticated `POST /api/candidate/resume/claim`: reads the cookie, looks up `claim_hash`, requires `claimed_by is null and expires_at > now()`.
3. In one transaction-like sequence: atomically `update … set claimed_by=auth.uid(), claimed_at=now() where claim_hash=$1 and claimed_by is null and expires_at>now() returning object_path` (single winner; a second use or replay gets 0 rows). Then the server **re-validates** the stored object (size, signature, sha256 matches), copies it to `resumes/{candidateId}/resume.{ext}` (service role), sets `candidates.resume_url`, stores the score, deletes the temp object, clears the cookie.
4. Failure handling: if the copy fails, the claim is released (`claimed_by=null`) and the temp file remains until TTL. Idempotent on retry.

Security properties: possession of the cookie is the only credential, it is bound to one account at first use, single-use, 24 h, `HttpOnly`, never in a URL. A different logged-in user with a copied cookie value could claim it first; this is accepted because the cookie is only ever on the original browser, and the file is the same one the original user chose to upload (low impact; documented residual risk). We do **not** claim by e-mail address (an attacker could register a victim's e-mail and "claim" their upload).

### 3.3 Accounts and e-mail verification

- **Create account without OTP.** Registration collects name, e-mail, password, terms (already simplified in PR #65). The user can be signed in immediately.
- **Verified e-mail only at security-sensitive points**: apply, password reset, e-mail change, and later "share profile with employers"/alerts to the e-mail. OTP (hardened per PR #67) is sent when the candidate presses **Apply** and `email_verified=false`; the apply modal shows "Verify your e-mail to apply" and continues the same application after verification (no lost progress).
- **Design decision needed (owner):** to let an unverified user hold a session, either (a) create the auth user with `email_confirm:true` and treat **`users.email_verified` as the only truth** (apply gate reads it, never `email_confirmed_at`), or (b) enable Supabase "allow unverified sign-in". (a) is recommended: no dashboard setting change, one code path. Risk of (a): an attacker can register a victim's e-mail first. Mitigations: unverified accounts cannot apply, receive e-mail, be shared with employers or reset a password; **password reset must require OTP** and a later genuine registration/verification of the same e-mail takes over the unverified row (the old password is invalidated); unverified accounts with no activity are purged after 30 days.
- **Apply gate in depth**: API check in `POST /api/applications` (`users.email_verified` + `candidates.resume_url`) **and** a RESTRICTIVE RLS policy on `applications` INSERT (`current_user_email_verified()`), so a missed API check still cannot create an application. Both are in the proposed migration.

### 3.4 Browse

No change needed. Keep job pages cacheable and indexable; ensure no browse API is placed behind auth. Add a regression test that `/jobs`, `/job/[slug]`, search and the public listing APIs return 200 with no cookies.

### 3.5 Deletion (TTL)

- Hard guarantee: `expires_at` 24 h. Unclaimed rows and objects are deleted by a **daily-or-hourly cron** (`/api/cron/purge-anonymous-resumes`, `CRON_SECRET`-gated like the existing crons, service role, deletes object first, then row; batch ≤200; logs counts only). Crons register on Production deployments only, so Preview needs a manual-trigger test.
- Defence in depth: the storage `resume-temp` bucket gets a lifecycle/periodic sweep for any object with no row (orphans from failed inserts); rows are inserted **before** the upload so an orphan can only be an object with a row, never a row-less object, and the sweep compares both directions.
- Immediate deletion: user `DELETE`, replacement upload, successful claim.
- Claimed rows are kept as metadata for 7 days (no file) for support/audit, then purged; the file lives on only in `resumes/{candidateId}/` under existing RLS.
- Free-tier note: this uses only Postgres + Storage + the existing cron; ₹0 extra.

### 3.6 Validation and abuse prevention

| Control | Detail |
|---|---|
| Size | `RESUME_MAX_BYTES` 4 MB everywhere; set bucket limit to 4 MB for `resume-temp`; align `resumes` bucket (5 MB) in a later migration |
| Body cap | `readBodyLimited` **before** `formData()` on every resume route (the authenticated route lacks it today) |
| Type | extension + MIME allow-list (PDF, DOCX), then **magic-byte check** (`hasValidResumeSignature`); DOCX must be a valid zip with `word/document.xml`; reject macros (`.docm`, `vbaProject.bin` inside the zip) |
| Zip bombs | bounded `extractResumeText`: cap uncompressed bytes and entry count, timeout |
| Malware | no execution/rendering server-side; stored private, never served inline to anyone but the claiming owner; `Content-Disposition: attachment`; optional async scan hook (e.g. ClamAV in a worker) is out of scope for free tier and listed as future |
| Rate limits | per-client + global via `distributedRateLimit` (`rl:` HMAC keys, no raw IP). **Fail closed for the stored-upload route** (reject with 503 if the limiter is degraded), fail open only for quick-score |
| Quotas | 1 live unclaimed resume per client_hash; global daily cap; storage budget alarm (e.g. >200 live rows) |
| PII | no IP, no e-mail stored on anonymous rows; file name is not stored; filenames in storage are random UUIDs |
| Logging | log only ids/counts/error codes, never file content, extracted text, or cookie values |
| Bot abuse | optional Cloudflare Turnstile on the stored-upload route only (not needed for quick-score) — decision for owner; skip initially |
| Privacy copy | before storing: "We keep your resume for 24 hours so you can save it to your account. Delete it any time. We don't share it with employers unless you apply." Link to privacy policy; the policy page needs a short update |

### 3.7 UX flow

1. Visitor browses jobs (no wall).
2. "Check my resume" → upload → instant score (today's behaviour, nothing stored).
3. Result card: **Save this resume & get matched** (opt-in, shows privacy line) → temp store + cookie → "Create free account" (name, e-mail, password).
4. After signup: resume appears in dashboard, score kept; saved jobs now work.
5. **Apply** → if unverified: OTP modal → verified → application submitted → status `pending_review` (admin approval before employer sees it; unchanged).

## 4. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Storage/abuse cost (anonymous uploads) | 24 h TTL, per-client cap, fail-closed limiter, global cap |
| 2 | PII retention of people who never sign up | opt-in only, 24 h, delete button, privacy copy, no IP/e-mail |
| 3 | Cookie claim hijack | HttpOnly/Secure/SameSite, single-use atomic claim, 24 h; residual risk accepted (see 3.2) |
| 4 | Unverified accounts squatting e-mails | unverified cannot apply/share/reset; takeover by real verification; purge in 30 days |
| 5 | `email_confirmed_at` vs `users.email_verified` divergence | one source of truth (`users.email_verified`), tests that no code reads `email_confirmed_at` for gating |
| 6 | Limiter fails open under DB error | fail-closed option for stored upload and auth routes |
| 7 | Malicious files (zip bombs, macros, polyglots) | signature + structure checks, bounded parse, never served back, attachment-only |
| 8 | Cron only registers on Production | manual-trigger test on staging; add monitoring of "expired rows older than 48 h" |
| 9 | Apply gate bypass | API + RESTRICTIVE RLS |
| 10 | Existing authenticated upload lacks bounded read/signature | fix in the same change set (required change R3) |
| 11 | Changing `email_confirm` semantics could affect existing users and password reset | staging-tested; existing verified users unaffected; migration is additive |

## 5. Required changes (when approved, not now)

R1. Migration `20261121000002_anonymous_resumes` (bucket, table, helper function, RESTRICTIVE apply policy) + rollback.
R2. New routes: `POST/GET/DELETE /api/resume/anonymous`, `POST /api/candidate/resume/claim`, `GET /api/cron/purge-anonymous-resumes` (+ `vercel.json` cron entry on Production).
R3. Harden `POST /api/candidate/resume`: bounded read, signature check, no blind `upsert` overwrite without validation.
R4. Registration: sign-in without OTP (design decision 3.3), apply flow with inline OTP step, `email_verified` check in `POST /api/applications`.
R5. UI: opt-in "Save resume" on `ResumeUploadWidget`/`ImproveFlow`; signup carries the claim; apply modal verification step; privacy copy.
R6. Env: `ANON_RESUME_PEPPER` (secret, server-only; staging and production differ), no new public vars.
R7. `distributedRateLimit`: add `failClosed` option. Same helper is reused by PR #67 (see its amendment); no second limiter table.
R8. Align bucket limit (5 MB → 4 MB) in a separate migration.
R9. Privacy policy text update.

## 6. Test plan

Local/unit (no network):
- Validation matrix: valid PDF, valid DOCX, renamed `.exe`, empty, 4 MB OK, 4 MB + 1 rejected, truncated PDF, DOCX with macro, oversized zip entry count, wrong MIME.
- Claim token: stored value is HMAC only; cookie flags; replay of a claimed token → 0 rows; expired token → rejected; two concurrent claims → exactly one wins.
- Limiter: client cap, global cap, degraded mode fails closed on stored upload, open on quick-score.
- Apply gate: unverified → 403 (API) and RLS rejects direct insert (verified locally with the proposed policy).

Staging (needs staging Supabase, **not yet configured**):
1. Anonymous browse with no cookies.
2. Anonymous quick-score (no OTP, nothing stored): check no row/object created.
3. Opt-in save → row + object in `resume-temp`; `anon`/`authenticated` keys cannot list/read it (RLS/storage probe).
4. Register without OTP → claim → resume in `resumes/{candidateId}/`, temp object deleted, cookie cleared.
5. Second account using the same cookie → rejected.
6. Apply while unverified → OTP prompt; after OTP → application created `pending_review`.
7. TTL: set `expires_at` in the past (staging-only edit) → trigger purge → row and object gone; orphan sweep.
8. Abuse: 4th stored upload within an hour → 429; limiter degraded simulation → 503.
9. Employer cannot read anonymous or unapproved resumes (existing RLS regression).
10. Existing verified users: login, dashboard, apply unaffected.

## 7. Local verification already done (no network, no real DB)

The proposed migration applied cleanly to the local scratch Postgres on top of the 34 existing migrations: `resume-temp` bucket is private with a 4 MB limit and **zero storage policies**; `anonymous_resumes` has RLS enabled and **zero policies**; the `applications_require_verified_email` policy is RESTRICTIVE on INSERT; `current_user_email_verified()` returns false for an unverified and true for a verified user. Rollback SQL is in `proposed-migrations/…down.sql` (not yet exercised).

## 8. Decisions needed from the owner

1. Opt-in temporary storage (B) vs. no persistence (A).
2. Unverified sign-in approach (3.3 a vs b).
3. TTL 24 h acceptable? Turnstile now or later?
4. Cookie-claim residual risk accepted?

Rollout order (after approval): migration on staging → routes behind a feature flag → staging tests → production cutover plan. Nothing is deployed or merged by this proposal.
