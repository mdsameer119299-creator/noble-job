# Candidate journey without OTP: browse, upload, score — proposal (DOCS ONLY)

Status: **proposal, nothing implemented.** No code, migration, env var, deployment or production change is made by this document. Separate from PR #67 (OTP security hardening). The SQL under `proposed-migrations/` is **not applied anywhere**; it was run only against a throwaway local Postgres to check it is valid and additive.

## 0. Owner decisions recorded (21 Nov 2026)

1. **Anonymous storage: approved, opt-in only.** Default scoring stores nothing. Temporary files expire after 24 h. A successful claim moves the resume to the candidate's private storage. Delete and replace must remove temporary files.
2. **Unverified accounts: approved with conditions.** Unverified candidates may browse, sign in and complete non-sensitive profile fields. **Verified e-mail is required to apply, to permanently claim an anonymous resume, to reset a password and to change e-mail.** Do not disable e-mail confirmation in a way that marks every account verified; the real verified status stays authoritative. Enforced in APIs **and** RLS/DB, not just UI.
3. **Claim cookie, original design NOT approved.** Required: 256-bit single-use tokens, HMAC-hashed storage, Secure/HttpOnly/SameSite cookie, expiry, atomic consumption, verified-account ownership before permanent linking, CSRF protection, and tests for replay, stolen-token and concurrent claims. Redesigned in 3.2 (a stolen cookie alone is now useless).
4. **Retention: 24 h maximum** for unclaimed anonymous resumes.
5. **Turnstile: deferred.** Start with server-side rate limits, file validation, request-size limits and cleanup; reassess after observing real abuse.
6. **PR #67 stays separate.** OTP is still not required to browse, upload anonymously or get a basic score.

**Second review (21 Nov 2026, 14:47):** the redesigned claim is **approved in principle** (256-bit single-use token, HMAC storage, e-mail binding, verified e-mail matching the visitor-provided e-mail, atomic claim, private temp storage with 24 h expiry, database-level ownership and verification). Before implementation: HTTP-level CSRF/replay/cross-user/concurrency tests and proof that cleanup deletes real storage objects (section 6, done on a prototype). **Supabase authentication is a blocker and is now answered (section 3.3): unverified password sign-in is NOT supported, so the fallback journey is the plan of record.**

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

**Token.** 32 bytes from `crypto.randomBytes` (256-bit), returned once. Only `claim_hash = HMAC-SHA256(ANON_RESUME_PEPPER, token)` is stored; lookups use the hash with a constant-time compare. Cookie `nj_resume_claim`: `HttpOnly; Secure; SameSite=Strict; Path=/api/resume/anonymous; Max-Age=86400`. Never in a URL, body echo, log or analytics event.

**CSRF.** The claim, status and delete endpoints accept `POST`/`DELETE` only, require `Content-Type: application/json`, reject unless `Origin` matches our host (and `Sec-Fetch-Site` is `same-origin` when present), and require a double-submit token: a second cookie `nj_csrf` (random, readable by JS) whose value must equal an `X-CSRF-Token` header, with `nj_csrf` bound to the claim token by HMAC. `SameSite=Strict` on the claim cookie is the first layer; these checks are the second.

**Claim (server, authenticated).** `POST /api/resume/anonymous/claim`:
1. Requires a signed-in session **and** `users.email_verified = true` (otherwise 403 `email_not_verified`; the unverified candidate sees "Verify your e-mail to save your resume" and the file stays pending until its 24 h expiry).
2. Calls the DB function `claim_anonymous_resume(claim_hash, user_id, email_hash)` (service-role only; SQL in `proposed-migrations/`). In one row-locked statement it consumes the token **only if** the token is unexpired, unclaimed, unrevoked, the account is verified, **and** `email_hash` equals the HMAC of the account's own e-mail.
3. A **wrong-mailbox attempt does not consume** the token, increments `bad_claims`, and **revokes** the token after 5 (so a thief cannot guess or burn through, and the victim's token is not silently consumed by a mismatch).
4. On success the server re-validates the stored object (size, signature, sha256), copies it to `resumes/{candidateId}/resume.{ext}`, sets `candidates.resume_url`, stores the score, deletes the temp object, and clears both cookies. If the copy fails the claim is released and retried (idempotent) until expiry.
5. Per-user and per-client claim attempts go through `distributedRateLimit` **fail-closed**.

Result: an attacker holding a copied cookie must also own a verified account whose e-mail equals the one the victim typed, i.e. control the victim's mailbox, which is already full account takeover. Residual risk is therefore not "cookie theft" but "mailbox compromise" and is accepted as out of scope. Edge cases: if the candidate signs up with a different e-mail than the one typed at opt-in, the claim is refused with a clear message and they may re-upload (nothing is lost but the 24 h window); the same applies if the cookie or the 24 h window is gone.

### 3.3 Accounts and e-mail verification: DEFINITIVE FINDING and fallback journey (plan of record)

**Finding: Supabase Auth does not support password sign-in for an unconfirmed e-mail, and no supported setting changes that without auto-confirming users.**

- By default an unverified e-mail user cannot sign in (Supabase user-management docs), and on hosted projects "confirm e-mail" is on by default (Password-based Auth docs).
- The auth server's password grant (`ResourceOwnerPasswordGrant` in `internal/api/token.go`, read from the supabase/auth `master` source) checks `user.IsConfirmed()` and returns `email_not_confirmed` unconditionally; it does not consult `AllowUnverifiedEmailSignIns`.
- That flag exists (`mailer_allow_unverified_email_sign_ins` appears in the Management API config schema), but a Supabase maintainer states in supabase/auth#2513 that it is **only honoured for OAuth providers**, and the thread has no fix or linked PR (latest comment Aug 2026 asks for an update). So it cannot give unverified **password** sign-in.
- The only supported way to let a password user in without e-mail confirmation is turning "Confirm email" off (autoconfirm) or creating users with `email_confirm:true`; both mark the account confirmed at the Auth layer, which the owner has ruled out. Reports (supabase/supabase#29632) also say admin-created unconfirmed users stay blocked even with the setting off.

I did not change any Supabase setting, call any API on a real project, or touch production; this is from documentation and upstream source. **Residual staging checks (S-1…S-3, no assumptions made):** S-1 confirm on the staging project that `signInWithPassword` for an admin-created `email_confirm:false` user returns `email_not_confirmed`; S-2 confirm what `/recover` does for an unconfirmed user (the upstream handler calls `sendPasswordRecovery` without a confirmation branch, and I could not see that function), and that completing it can at most confirm the Auth record without setting `users.email_verified`; S-3 real Supabase Storage delete behaviour (below).

**Fallback journey (adopted; OTP appears only where an account is created):**

| Step | Account | OTP / verified e-mail |
|---|---|---|
| Browse jobs | none | no |
| Upload + basic score (nothing stored) | none | **no** |
| Optional "Save my resume for 24 h" (types the e-mail they will use; file held in private temp storage) | none | **no** (no e-mail is sent) |
| Create account to save permanently or apply: name, e-mail, password | created, **cannot sign in yet** | e-mail OTP verification (existing custom OTP, hardened by #67) |
| First sign-in after verification | verified | done |
| Pending resume claim runs (same browser, cookie still valid) | verified + e-mail hash must match | already satisfied |
| Save jobs, complete profile, apply | verified | no further OTP |
| Password reset, e-mail change | verified | OTP / confirmation again |

What this gives up compared with the earlier idea: no session before verification, so no profile editing or saved jobs while unverified. Mitigation: the registration wizard collects profile fields in the browser and they are saved after the first sign-in (existing onboarding), and the 24 h temp resume stays claimable after verification if the cookie survives. If the candidate takes longer than 24 h they simply re-upload (nothing is lost but the stored copy).

**Authoritative status and database enforcement (kept as defence in depth, tested locally):** `users.email_verified` stays the only app-level truth, written only by the verify-OTP route with the service role; Auth confirmation is **not** set by anything except that route. Even though Auth already refuses unverified sign-ins, the following are enforced in the database so a bug, a future change of Auth settings, or an OAuth path cannot bypass them: RESTRICTIVE RLS `applications_require_verified_email`; `claim_anonymous_resume` refuses unverified users; `guard_candidate_resume_url` rejects non-service-role resume changes by unverified users.

**Supabase endpoints reachable with the anon key:** `/recover` and the e-mail-change endpoint are public APIs. The app does not use `/recover` (own OTP reset route), and e-mail change needs a session, which unverified users cannot obtain. S-2 verifies the remaining edge; if it shows a gap, reset/change is routed only through our server with a verified check.

**Squatting:** an attacker can register a victim's e-mail but the account cannot sign in, apply, claim or reset until the mailbox owner verifies; the later genuine verification takes over the row (password replaced by the owner's reset) and unverified rows are purged after 30 days.

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
| 5 | Supabase does not support unverified password sign-in (finding 3.3); endpoints reachable with the anon key (`/recover`) | fallback journey adopted; `users.email_verified` stays the only truth; no auto-confirm; S-2 staging check |
| 5b | Opt-in e-mail typo / different signup e-mail blocks the claim | clear error, re-upload within window; e-mail shown back before save |
| 6 | Limiter fails open under DB error | fail-closed option for stored upload and auth routes |
| 7 | Malicious files (zip bombs, macros, polyglots) | signature + structure checks, bounded parse, never served back, attachment-only |
| 8 | Cron only registers on Production | manual-trigger test on staging; add monitoring of "expired rows older than 48 h" |
| 9 | Apply gate bypass | API + RESTRICTIVE RLS |
| 10 | Existing authenticated upload lacks bounded read/signature | fix in the same change set (required change R3) |
| 11 | Changing `email_confirm` semantics could affect existing users and password reset | staging-tested; existing verified users unaffected; migration is additive |

## 5. Required changes (when approved, not now)

R1. Migration `20261121000002_anonymous_resumes` (bucket, table with `email_hash`, helper, RESTRICTIVE apply policy, `claim_anonymous_resume`, `guard_candidate_resume_url`) + rollback.
R2. New routes: `POST/GET/DELETE /api/resume/anonymous` (opt-in store, status, delete; delete and replace also remove the temp object), `POST /api/resume/anonymous/claim`, `GET /api/cron/purge-anonymous-resumes` (`vercel.json` cron on Production; manual trigger on staging).
R3. Harden `POST /api/candidate/resume`: bounded read, signature check, no blind overwrite.
R4. Auth: **no change to Supabase settings**; registration/OTP flow keeps sign-in blocked until verified; the wizard defers profile saving until after first sign-in; auto-claim after first sign-in; `email_verified` check in apply (API + RLS).
R5. UI: opt-in "Save my resume" with e-mail field and privacy copy; pending-claim notice for unverified users; apply modal verification step; claim after verification.
R6. Env: `ANON_RESUME_PEPPER` (server secret; separate staging/production values; branch-scoped Preview only for `integration/launch`). No new public vars.
R7. `distributedRateLimit`: `failClosed` option (shared with PR #67, implemented once).
R8. Align `resumes` bucket limit to 4 MB (separate migration). R9. Privacy policy text.
R10. CSRF helper (Origin/Sec-Fetch-Site check + double-submit token) used by the three anonymous endpoints and claim.

**Staging checks (S-1…S-3, section 3.3)** before implementation sign-off. I-1 is answered (unsupported); I-2 reduced to S-2.

## 6. Test plan

**HTTP-level results (prototype, 4 identical runs, 73 checks, 0 failures; source and output in `prototype-tests/`):**
- Token/cookie: 32-byte random token; only its HMAC is stored; no plaintext e-mail or IP in the DB; cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/resume/anonymous; Max-Age=86400`.
- Validation: renamed `.exe`, empty, unsupported type, bad/missing e-mail, junk `.docx`, 4 MB+1 and an oversized body are all rejected with **no row and no object created**; just-under-4 MB PDF and a valid DOCX accepted.
- Replace and delete: a second upload from the same client replaces the row **and deletes the old object**; DELETE needs the CSRF header and same Origin (otherwise 403, nothing deleted) and then removes row and object and clears the cookie. 4th stored upload in the window → 429; limiter degraded → 503 (fail closed).
- **CSRF / request shape:** missing, wrong or other-token CSRF header, missing or foreign `Origin`, `Sec-Fetch-Site: cross-site`, `Content-Type: text/plain`, GET, no session, no cookie → 403 / 415 / 405 / 401 / 404, and **none of them consumed or damaged the token**.
- **Replay:** after a successful claim, replay by the owner and by another user → refused; the other user's profile never gets the resume.
- **Cross-user / stolen token:** verified user B holding the cookie and CSRF value but a different e-mail → refused, token not consumed, counter incremented; the real owner can then still claim; 5 wrong attempts revoke the token (accepted trade-off: the owner must re-upload).
- **Unverified account:** 403 `email_not_verified`, token untouched, nothing attached; after verification the same pending resume is claimable.
- **Concurrency:** 20 parallel claims by the owner → exactly **one** 200; mixed 10 owner + 10 thief → exactly one winner, and it is the e-mail owner; one permanent object, zero temp objects.
- **Cleanup deletes real objects:** after claim the temp file is physically gone and the permanent copy exists at `resumes/{candidateId}/resume.pdf`; expired rows are purged **and their files are gone from disk**; an orphan object with no row is removed; if the storage delete fails the row is **kept for retry** (never row-deleted while the object remains), then succeeds on retry; a claimed row whose temp removal failed is swept; a failed permanent copy releases the claim and a retry succeeds; expired tokens cannot be claimed even before the purge runs (the database enforces expiry).
- Logs contain no e-mails, tokens, CSRF values or cookies.
- Earlier SQL-level tests (unverified/stolen/replay/expired/5-strike/privileges/8-way race/`resume_url` guard, up-down-up migration) also passed.

**Limits of this evidence:** session is a stub and storage is a local directory, so the real Supabase Storage `remove` call and real JWT/RLS paths still need the staging run (S-3). Fix found while testing: the claim route must live under the cookie's path, so it is `/api/resume/anonymous/claim` (the doc previously placed it elsewhere).

Unit/API tests (to be written at implementation):
- Validation matrix: valid PDF/DOCX, renamed `.exe`, empty, 4 MB ok, 4 MB+1 rejected, truncated PDF, DOCX with macro, zip entry-count/size bombs, wrong MIME, oversized body rejected **before** parsing.
- Default scoring creates **no** row/object; opt-in creates exactly one; second upload replaces and deletes the first object; DELETE removes row, object and cookies.
- Token: 256-bit, stored only as HMAC, cookie flags (Secure/HttpOnly/SameSite=Strict/Path/Max-Age), absent from logs, URLs and analytics.
- **CSRF:** claim without header → 403; wrong `Origin` → 403; cross-site `Sec-Fetch-Site` → 403; mismatched double-submit token → 403; non-JSON content type → 415.
- **Replay / stolen / concurrent:** as in the local list, but through the HTTP route with real sessions.
- Rate limits: per-client and global caps; limiter degraded → stored upload and claim return 503 (fail-closed), quick-score stays open.
- Apply gate: unverified → 403 from API **and** direct PostgREST insert rejected by RLS.
- Unverified account: cannot sign in at all (S-1); direct DB writes by a hypothetically unverified session are still rejected (RLS/trigger, tested locally).
- Existing verified users: login, dashboard, apply unaffected; employer cannot read anonymous or unapproved resumes.

Staging (needs staging Supabase, **not yet configured**): S-1…S-3; full journey (browse → score → opt-in save → register → OTP verify → first sign-in → auto-claim → apply); TTL test with a past `expires_at` then cron trigger and orphan sweep; storage probe with `anon`/`authenticated` keys against `resume-temp`; log review for tokens/PII.

## 7. Local verification already done (no network, no real DB)

See section 6. Migration SQL is `proposed-migrations/20261121000002_anonymous_resumes.sql` (+ `.down.sql`, exercised up/down/up locally). `resume-temp` bucket has zero storage policies; `anonymous_resumes` has RLS on and zero policies. Not applied to any Supabase project.

## 8. Open items (nothing blocks the docs; these gate implementation)

1. Staging checks S-1…S-3 (Auth behaviour for unconfirmed users, `/recover`, real Storage delete). Needs the staging project; **staging setup is not requested yet**.
2. Owner approval of the fallback journey as the plan of record (3.3) and of the final claim design, then S-1…S-3 on staging.
3. Privacy-policy wording.

Rollout order (after approval): migration on staging → routes behind a feature flag → staging tests → production cutover plan. Nothing is deployed or merged by this proposal.
