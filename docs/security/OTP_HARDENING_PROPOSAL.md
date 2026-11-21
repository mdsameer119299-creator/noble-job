# Proposal: OTP hardening (docs-only PR — NO production code changes)

Status: PROPOSAL for owner review. Nothing here is implemented, applied to any database, or deployed. Implementation would be a separate PR after approval, tested on staging first.

## 1. Current behaviour (read from code on `main`)
| Area | Today | Where |
|---|---|---|
| Code generation | 6 digits via `Math.random()` (not a cryptographic RNG) | `src/lib/services/otpService.ts` |
| Storage | unsalted `sha256(code)` in `otp_tokens.otp_hash`; 10-minute `expires_at`; `is_used` flag | same + initial migration |
| Active codes | every request inserts a NEW row; older unused codes stay valid → N resends = N valid codes | same |
| Verification | select by `(email, hash, type, unused, unexpired)` then update `is_used` — two statements, not atomic; no per-token attempt counter | `verifyOtp` |
| Account-level lockout | **exists**: 5 failed `otp_verify` / 30 min per email (also 5 password_reset, 10 login), persisted in `auth_failures` | `authFailureService.ts`, route |
| Lockout check | read-then-act (check `isLockedOut`, then verify, then record failure) → concurrent requests can all pass the check before any failure is recorded; logging/DB errors are swallowed (fail-open) | route + service |
| Rate limiting | per-IP, **in-memory `Map`** per server instance (verify-otp 10/min, register 3/min, forgot-password 3/min) → not shared across serverless instances; IP from `x-forwarded-for` first hop | `src/lib/utils/rateLimit.ts`, route |
| Resend/cooldown | no per-email cooldown or hourly cap on sending OTP emails (email-bombing a victim from many IPs) | `generateAndSendOtp` |
| Lockout side-effect | an attacker can intentionally lock a victim's email out of OTP verification for 30 min | design |

## 2. Risks (ranked)
1. **Concurrent-guess bypass** of the 5-failure lockout (race) + multiple simultaneously valid codes → success probability per guess = (#active codes)/10⁶, and the number of guesses is bounded only by concurrency, not by the lockout.
2. **Non-cryptographic code + unsalted hash**: if `otp_tokens` leaks (backup, SQL injection, log), codes are recoverable instantly (10⁶ possibilities) within their 10-min life.
3. **Per-instance in-memory limiter** is ineffective on Vercel (many instances); per-IP only.
4. **No send throttling per email** (abuse/cost: Resend quota, reputation).
5. **Fail-open** lockout accounting on DB errors.

## 3. Proposed design
**3.1 Generation:** `crypto.randomInt(0, 1_000_000)` zero-padded; keep 6 digits (UX) — strength comes from the controls below.
**3.2 Hashing:** `HMAC-SHA256(OTP_PEPPER, email|type|code)` with a server-only secret `OTP_PEPPER` (new env var, Production secret; staging gets its own). A DB leak alone is then useless; rotate by re-issuing (codes live ≤10 min, so rotation = in-flight codes fail, users request a new one). Compare with `timingSafeEqual`.
**3.3 One active code per (email,type):** issuing a code marks previous unused ones superseded (partial unique index `(email,type) WHERE NOT is_used`).
**3.4 Expiry:** keep ≤10 min (password_reset: 10, email_verify: 10); purge expired rows opportunistically (delete older than 24 h on insert) to keep the table small.
**3.5 Atomic verification with per-token attempts:** a Postgres function `verify_otp(p_email, p_type, p_hash)` that, in one statement/transaction, locks the active row (`FOR UPDATE`), rejects if `attempts >= 5` or expired, increments `attempts`, compares hash, and marks used on match. Removes the race, so ≤5 guesses per code **regardless of concurrency**; after 5, the code is dead and a new one must be requested.
**3.6 Account-level limits (keep, make atomic):** keep the 30-min `auth_failures` lockout but count inside the same function/transaction; add a generic, non-enumerating response; to limit lockout-DoS, key lockout on `(email, source ip bucket)` for verification and cap *per-email* total at a higher ceiling (e.g. 15/30 min) with CAPTCHA/step-up later.
**3.7 Send throttling:** per-email cooldown 60 s and max 5 sends/hour (counted in the DB), uniform response to avoid account enumeration.
**3.8 Distributed rate limiting (reuse, no new table):** the repo already has a durable cross-instance limiter, `src/lib/security/distributedRateLimit.ts` (backed by `auth_failures`, `rl:`+HMAC keys, no raw IP), used by `/api/resume/quick-score`. Auth routes still use an in-memory per-IP `Map`. Change: route auth limits (login, register, verify-otp, forgot-password, reset-password, OTP send) through this helper and add a **`failClosed` option** (return 503 when the limiter is degraded) for auth/OTP routes; quick-score keeps fail-open. **No `rate_limits` table or `rate_limit_hit` function is needed** (superseded; earlier draft proposed them).
**3.8b Where OTP applies (product decision, see candidate-journey proposal):** OTP is **not** required to browse, upload a resume or get a basic score, nor to create an account and save. It is required at **apply**, password reset and e-mail change. This lowers OTP volume (fewer sends, less abuse surface) but makes each OTP gate more security-relevant, so 3.3-3.7 and 3.9 stay as designed.
**3.9 Fail-closed:** if limit/lockout accounting errors on auth routes, return 503 (user retries) instead of allowing the attempt.

## 4. Proposed migration (NOT applied; to be reviewed as SQL before any run; additive)
```sql
alter table public.otp_tokens
  add column if not exists attempts smallint not null default 0,
  add column if not exists superseded_at timestamptz;
create unique index if not exists otp_tokens_one_active_idx on public.otp_tokens(email, type) where not is_used and superseded_at is null;
-- function: verify_otp(...)  — SECURITY DEFINER, search_path pinned, EXECUTE only to service_role
```
Rollback: `drop function verify_otp`, `drop index otp_tokens_one_active_idx`, `alter table … drop column attempts, superseded_at` (all additive, no data loss to existing rows).
New secret: `OTP_PEPPER` (Production secret + separate staging value; never in non-branch Preview).

## 5. Rollout and compatibility
Staging first (integration branch + staging Supabase) → production after owner approval. Deploy order: migration (additive) → code. In-flight codes issued by the old code (sha256) simply fail verification after deploy; users request a new code (≤10 min impact). No dual-hash support needed. Feature can be dark-launched behind `OTP_HARDENING=1` for one release if desired.

## 6. Test plan (staging)
Unit: `randomInt` range/zero-padding; HMAC stable & email/type-bound; timing-safe compare. SQL: `verify_otp` — 5 wrong guesses kill the code; 100 parallel wrong guesses count exactly ≤5 attempts; superseded codes rejected; expiry; reuse. Integration: send cooldown (2nd request <60 s → 429), 6th send/hour → 429, uniform responses for unknown emails; cross-instance limit (hit from 2+ instances shares one counter); fail-closed when DB unavailable (503). Regression: existing registration/OTP/password-reset UI flows.

## 7. Out of scope / follow-ups
CAPTCHA, WebAuthn/passkeys, replacing custom OTP with Supabase Auth OTP, account-enumeration review of the register endpoints.


## 7. Owner decisions (21 Nov 2026) and relationship to the anonymous-resume proposal (updated 14:47)

This PR stays **separate** from the anonymous-resume work (PR #68). Principle preserved: **OTP is never required to browse jobs, upload a resume anonymously, get a basic resume score, or temporarily store a resume.**

**Supabase finding (see #68 section 3.3):** Supabase password sign-in is not supported for unconfirmed e-mails (the auth server's password grant rejects them with `email_not_confirmed`; `mailer_allow_unverified_email_sign_ins` is only honoured for OAuth per a maintainer in supabase/auth#2513). So the fallback journey applies and this PR's earlier idea of an *authenticated* OTP-send endpoint is **withdrawn**: before first sign-in there is no session.

1. **Where OTP is required:** account creation (verification before the first sign-in, which gates saving permanently and applying), password reset, e-mail change. No separate OTP at apply: only verified accounts can sign in, so apply/claim are already verified.
2. **Authoritative verified status:** `users.email_verified`, written only by the verify-OTP path with the service role. Never auto-confirm at the Auth layer (no `email_confirm:true` at creation, no "Confirm email: off").
3. **Send endpoint (pre-session):** keyed by e-mail but only for an existing **unverified** account (or reset request), uniform response (no enumeration), 60 s per-email cooldown, 5 sends/hour per email and per IP bucket, fail-closed via `distributedRateLimit`. Because OTP now appears only at account creation/reset, the volume surface is smaller than "OTP on every action" but is still unauthenticated, so 3.5-3.9 stay as designed.
4. **Limiter:** reuse `distributedRateLimit` with `failClosed` (3.8), implemented once and shared with #68.
5. **DB enforcement:** apply gate (`applications_require_verified_email`), claim function and `resume_url` guard live in #68's proposed migration; this PR owns only OTP table/function changes.
6. **Added tests:** verify sets only `users.email_verified` (and the Auth confirmation the existing flow already performs); send for a verified or unknown e-mail returns the same response; reset-password and e-mail-change reject unverified accounts; OTP is never requested by the anonymous upload, score, temp-store or claim endpoints (route test); fail-closed returns 503 when the limiter is degraded.
7. **Risk:** registration still creates an Auth user that cannot sign in until verified, so e-mail squatting rows exist; purge unverified rows after 30 days and let genuine verification take over.

No implementation, merge, migration run or production change is part of this update.
