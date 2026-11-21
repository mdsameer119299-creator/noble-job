# Candidate journey without OTP: browse, upload, score — proposal (DOCS ONLY)

Status: **proposal, nothing implemented.** No code, migration, env var, deployment or production change is made by this document. Separate from PR #67 (OTP security hardening). The SQL under `proposed-migrations/` is **not applied anywhere**; it was run only against a throwaway local Postgres to check it is valid and additive.

## 0. Owner decisions recorded (21 Nov 2026)

1. **Anonymous storage: approved, opt-in only.** Default scoring stores nothing. Temporary files expire after 24 h. A successful claim moves the resume to the candidate's private storage. Delete and replace must remove temporary files.
2. **Unverified accounts: approved with conditions.** Unverified candidates may browse, sign in and complete non-sensitive profile fields. **Verified e-mail is required to apply, to permanently claim an anonymous resume, to reset a password and to change e-mail.** Do not disable e-mail confirmation in a way that marks every account verified; the real verified status stays authoritative. Enforced in APIs **and** RLS/DB, not just UI.
3. **Claim cookie, original design NOT approved.** Required: 256-bit single-use tokens, HMAC-hashed storage, Secure/HttpOnly/SameSite cookie, expiry, atomic consumption, verified-account ownership before permanent linking, CSRF protection, and tests for replay, stolen-token and concurrent claims. Redesigned in 3.2 (a stolen cookie alone is now useless).
4. **Retention: 24 h maximum** for unclaimed anonymous resumes.
5. **Turnstile: deferred.** Start with server-side rate limits, file validation, request-size limits and cleanup; reassess after observing real abuse.
6. **PR #67 stays separate.** OTP is still not required to browse, upload anonymously or get a basic score.

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
- **B. Opt-in temporary storage (recommended).** Persist **only when the candidate chooses "Save my resume"** (button after the score is shown, with consent copy and an e-mail field used to bind the claim, 3.2). The default stays A, so a casual score never stores a file.

For B:

- New private bucket `resume-temp` with **no storage policies at all**, so `anon`/`authenticated` can never read or write; only server routes using the service role can.
- Table `anonymous_resumes` (RLS on, no policy → service-role only): `claim_hash`, random `object_path` (`<uuid>.<ext>`, never from user data), `ext`, `size_bytes`, `sha256`, `score`, `client_hash` (HMAC of IP, no raw IP), `expires_at` (default now+24 h), `claimed_by`, `claimed_at`. See `proposed-migrations/20261121000002_anonymous_resumes.sql`.
- **Claim token**: see 3.2 (256-bit, HMAC-stored, `HttpOnly; Secure; SameSite=Strict` cookie, CSRF-protected, bound to the opt-in e-mail hash).
- API (new, server-only):
  - `POST /api/resume/anonymous` : same pipeline as quick-score (bounded body, signature, parse) **plus** stores the file, sets the cookie, returns the score. Stricter, fail-closed limit (e.g. 3 stored uploads / h per client, 200 / day global) and a cap of **1 live unclaimed resume per `client_hash`** (new upload replaces the old and deletes its object).
  - `GET /api/resume/anonymous/status` : whether a live claim exists (no file content).
  - `DELETE /api/resume/anonymous` : candidate deletes it now (privacy control; also clears the cookie).
  - No download endpoint for anonymous files. Nothing but the claim step ever reads the object.

### 3.2 Secure linking to a new account (redesigned: stolen cookie is not enough)

The earlier design let whoever held the cookie claim the file after registering any account. That is **withdrawn**. New design, two independent factors: *possession of the token* **and** *control of the mailbox the visitor named when opting in*.

**Opt-in step (anonymous).** When the visitor clicks "Save my resume" they enter the e-mail they will sign up with. We store only `email_hash = HMAC(pepper, lower(trim(email)))`; no plaintext e-mail, and **no e-mail or OTP is sent at this step** (so nothing can be used to spam a third party and the "no OTP to upload" principle is intact).

**Token.** 32 bytes from `crypto.randomBytes` (256-bit), returned once. Only `claim_hash = HMAC-SHA256(ANON_RESUME_PEPPER, token)` is stored; lookups use the hash with a constant-time compare. Cookie `nj_resume_claim`: `HttpOnly; Secure; SameSite=Strict; Path=/api/resume; Max-Age=86400`. Never in a URL, body echo, log or analytics event.

**CSRF.** The claim, status and delete endpoints accept `POST`/`DELETE` only, require `Content-Type: application/json`, reject unless `Origin` matches our host (and `Sec-Fetch-Site` is `same-origin` when present), and require a double-submit token: a second cookie `nj_csrf` (random, readable by JS) whose value must equal an `X-CSRF-Token` header, with `nj_csrf` bound to the claim token by HMAC. `SameSite=Strict` on the claim cookie is the first layer; these checks are the second.

**Claim (server, authenticated).** `POST /api/candidate/resume/claim`:
1. Requires a signed-in session **and** `users.email_verified = true` (otherwise 403 `email_not_verified`; the unverified candidate sees "Verify your e-mail to save your resume" and the file stays pending until its 24 h expiry).
2. Calls the DB function `claim_anonymous_resume(claim_hash, user_id, email_hash)` (service-role only; SQL in `proposed-migrations/`). In one row-locked statement it consumes the token **only if** the token is unexpired, unclaimed, unrevoked, the account is verified, **and** `email_hash` equals the HMAC of the account's own e-mail.
3. A **wrong-mailbox attempt does not consume** the token, increments `bad_claims`, and **revokes** the token after 5 (so a thief cannot guess or burn through, and the victim's token is not silently consumed by a mismatch).
4. On success the server re-validates the stored object (size, signature, sha256), copies it to `resumes/{candidateId}/resume.{ext}`, sets `candidates.resume_url`, stores the score, deletes the temp object, and clears both cookies. If the copy fails the claim is released and retried (idempotent) until expiry.
5. Per-user and per-client claim attempts go through `distributedRateLimit` **fail-closed**.

Result: an attacker holding a copied cookie must also own a verified account whose e-mail equals the one the victim typed, i.e. control the victim's mailbox, which is already full account takeover. Residual risk is therefore not "cookie theft" but "mailbox compromise" and is accepted as out of scope. Edge cases: if the candidate signs up with a different e-mail than the one typed at opt-in, the claim is refused with a clear message and they may re-upload (nothing is lost but the 24 h window); the same applies if the cookie or the 24 h window is gone.

### 3.3 Accounts and e-mail verification (conditions applied)

Allowed **without** verified e-mail: sign in, browse, view and complete non-sensitive profile fields (name, category, skills, experience, location), save jobs, see a pending-claim notice.
Requires **verified** e-mail: apply, permanent resume claim, password reset, e-mail change, setting/changing `candidates.resume_url`, and (future) sharing profile or receiving alerts at that address.

**Supabase mechanism: findings (to confirm on staging before any design is locked).**
- Documented default: a user with an unverified e-mail cannot sign in (Supabase user-management docs; `email_not_confirmed`).
- The documented Auth switch is **Email provider → "Confirm email"**. Turning it **off** lets users sign in but is the very thing the owner ruled out: the user is then treated as confirmed (`email_confirmed_at` set at signup per community reports), which would stop `email_confirmed_at` meaning "verified".
- Reports (supabase/supabase #29632) say users **created through the admin API** with `email_confirm:false` still get `email_not_confirmed` even when the setting is off, which matches how `registerCandidate` creates users today.
- I could not find a documented dashboard control literally named "Allow unverified email sign-ins" in the public docs I searched. A newer Auth (GoTrue) option for allowing unverified e-mail sign-in may exist for hosted projects; **this must be confirmed in the staging project's Auth settings / Management API**, not assumed. This is Investigation task I-1 below.
- Because Supabase's own endpoints are reachable with the public anon key (`/recover`, `PUT /user` for e-mail change), "reset password / change e-mail need verified e-mail" **cannot be enforced only in our app routes**. I-2 verifies what Supabase itself does for unconfirmed users (does `/recover` send anything, does `updateUser({email})` require confirmation on both addresses) and, where it is insufficient, the plan is: disable client-side use of those endpoints where possible, route reset/change through our own server routes that check `users.email_verified`, and use Auth hooks (Send Email hook) to suppress mails for unverified accounts.

**Decision path (no code until approved):**
- **Preferred (a):** if staging confirms a supported "allow unverified sign-in" option that keeps `email_confirmed_at` null, use it. `users.email_verified` stays the only truth and is set only by the verify-OTP route (service role). Nothing is auto-confirmed.
- **Fallback (b), only with a fresh owner decision:** keep Confirm Email on and issue sessions from our own server after password check. This adds a custom-session surface and is **not** recommended.
- **Rejected (c):** `email_confirm:true` at creation or turning Confirm Email off, because it marks accounts verified at the Auth layer (owner condition 2).

**Enforcement in APIs and RLS/DB (all in the proposed migration, tested locally):**
- `POST /api/applications`: API checks `users.email_verified` and a resume; plus RESTRICTIVE RLS policy `applications_require_verified_email` on INSERT.
- Claim: API check plus the DB function itself refuses unverified users (see 3.2).
- `candidates.resume_url`: trigger `guard_candidate_resume_url` rejects changes by non-service-role callers whose e-mail is unverified, so an unverified user cannot attach any resume by writing the column through PostgREST.
- Password reset / e-mail change: server routes require verified status; Supabase-side behaviour per I-2.
- `users.email_verified`/`role`/`status` remain service-role-only writes (existing migration `20261001000001`).

**Squatting risk** (attacker registers a victim's address unverified): unverified accounts cannot apply, claim, reset or share; a later genuine verification of that e-mail takes over the row and invalidates the old password; inactive unverified accounts are purged after 30 days.

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
| Bot abuse | **Turnstile deferred (owner decision).** Start with the controls above; add metrics (stored uploads/h, 429 rate, rejected files) so abuse is observable, and reassess |
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
| 3 | Claim-cookie theft | **Not accepted.** Token alone cannot claim: needs a verified account whose e-mail hash matches the opt-in e-mail; single-use, atomic, 5-strike revoke, CSRF, Strict cookie (3.2) |
| 4 | Unverified accounts squatting e-mails | unverified cannot apply/share/reset; takeover by real verification; purge in 30 days |
| 5 | Supabase Auth settings: unverified sign-in support unconfirmed; Supabase endpoints reachable with the anon key (`/recover`, e-mail change) | staging investigation I-1/I-2 before locking design; `users.email_verified` is the only truth; no auto-confirm |
| 5b | Opt-in e-mail typo / different signup e-mail blocks the claim | clear error, re-upload within window; e-mail shown back before save |
| 6 | Limiter fails open under DB error | fail-closed option for stored upload and auth routes |
| 7 | Malicious files (zip bombs, macros, polyglots) | signature + structure checks, bounded parse, never served back, attachment-only |
| 8 | Cron only registers on Production | manual-trigger test on staging; add monitoring of "expired rows older than 48 h" |
| 9 | Apply gate bypass | API + RESTRICTIVE RLS |
| 10 | Existing authenticated upload lacks bounded read/signature | fix in the same change set (required change R3) |
| 11 | Changing `email_confirm` semantics could affect existing users and password reset | staging-tested; existing verified users unaffected; migration is additive |

## 5. Required changes (when approved, not now)

R1. Migration `20261121000002_anonymous_resumes` (bucket, table with `email_hash`, helper, RESTRICTIVE apply policy, `claim_anonymous_resume`, `guard_candidate_resume_url`) + rollback.
R2. New routes: `POST/GET/DELETE /api/resume/anonymous` (opt-in store, status, delete; delete and replace also remove the temp object), `POST /api/candidate/resume/claim`, `GET /api/cron/purge-anonymous-resumes` (`vercel.json` cron on Production; manual trigger on staging).
R3. Harden `POST /api/candidate/resume`: bounded read, signature check, no blind overwrite.
R4. Auth: sign-in for unverified candidates via the confirmed Supabase mechanism (I-1), `email_verified` checks in apply, password-reset and e-mail-change routes (I-2).
R5. UI: opt-in "Save my resume" with e-mail field and privacy copy; pending-claim notice for unverified users; apply modal verification step; claim after verification.
R6. Env: `ANON_RESUME_PEPPER` (server secret; separate staging/production values; branch-scoped Preview only for `integration/launch`). No new public vars.
R7. `distributedRateLimit`: `failClosed` option (shared with PR #67, implemented once).
R8. Align `resumes` bucket limit to 4 MB (separate migration). R9. Privacy policy text.
R10. CSRF helper (Origin/Sec-Fetch-Site check + double-submit token) used by the three anonymous endpoints and claim.

**Investigation tasks (staging, read-only/config inspection, before design is locked):** I-1 which Auth setting allows sign-in without confirming e-mail and whether `email_confirmed_at` stays null; I-2 behaviour of `/recover` and `updateUser({email})` for unconfirmed users; I-3 whether Supabase Storage/Auth settings differ between production and staging.

## 6. Test plan

**Verified locally on a scratch Postgres (21 Nov 2026), all passed:** unverified account cannot claim (0 rows); stolen token with wrong mailbox gets 0 rows, token **not** consumed, `bad_claims` incremented; legitimate verified owner claims (1 row); **replay** by the same or another user gets 0 rows; expired token 0 rows; 5 wrong-mailbox attempts **revoke** the token and even the owner is then refused; `anon` and `authenticated` have no EXECUTE on the claim function, `service_role` does; **8 parallel claims → exactly one winner**; `candidates.resume_url` update by an unverified authenticated user is rejected, allowed for a verified user and for `service_role`; migration up/down/up clean.

Unit/API tests (to be written at implementation):
- Validation matrix: valid PDF/DOCX, renamed `.exe`, empty, 4 MB ok, 4 MB+1 rejected, truncated PDF, DOCX with macro, zip entry-count/size bombs, wrong MIME, oversized body rejected **before** parsing.
- Default scoring creates **no** row/object; opt-in creates exactly one; second upload replaces and deletes the first object; DELETE removes row, object and cookies.
- Token: 256-bit, stored only as HMAC, cookie flags (Secure/HttpOnly/SameSite=Strict/Path/Max-Age), absent from logs, URLs and analytics.
- **CSRF:** claim without header → 403; wrong `Origin` → 403; cross-site `Sec-Fetch-Site` → 403; mismatched double-submit token → 403; non-JSON content type → 415.
- **Replay / stolen / concurrent:** as in the local list, but through the HTTP route with real sessions.
- Rate limits: per-client and global caps; limiter degraded → stored upload and claim return 503 (fail-closed), quick-score stays open.
- Apply gate: unverified → 403 from API **and** direct PostgREST insert rejected by RLS.
- Unverified profile: can sign in/browse/edit non-sensitive fields; cannot set `resume_url`, apply, claim, reset password or change e-mail.
- Existing verified users: login, dashboard, apply unaffected; employer cannot read anonymous or unapproved resumes.

Staging (needs staging Supabase, **not yet configured**): I-1/I-2 investigations; full journey (browse → score → opt-in save → register unverified → pending notice → OTP verify → claim → apply); TTL test with a past `expires_at` then cron trigger and orphan sweep; storage probe with `anon`/`authenticated` keys against `resume-temp`; log review for tokens/PII.

## 7. Local verification already done (no network, no real DB)

See section 6. Migration SQL is `proposed-migrations/20261121000002_anonymous_resumes.sql` (+ `.down.sql`, exercised up/down/up locally). `resume-temp` bucket has zero storage policies; `anonymous_resumes` has RLS on and zero policies. Not applied to any Supabase project.

## 8. Open items (nothing blocks the docs; these gate implementation)

1. Staging investigation I-1/I-2 (Supabase unverified sign-in mechanism and `/recover`, e-mail-change behaviour). Needs the staging project; **staging setup is not requested yet**.
2. Owner sign-off on the redesigned claim (3.2) and on the confirmed Auth mechanism (3.3) once I-1 is done.
3. Privacy-policy wording.

Rollout order (after approval): migration on staging → routes behind a feature flag → staging tests → production cutover plan. Nothing is deployed or merged by this proposal.
