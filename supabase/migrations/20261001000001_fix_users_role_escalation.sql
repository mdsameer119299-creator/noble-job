-- CRITICAL security fix (2026-10-01): close a privilege-escalation hole in
-- the `users` table's RLS policy, found and empirically reproduced by the
-- production-readiness audit of commit 36cc9bbd (PR #42, "rls-security-fix").
--
-- ROOT CAUSE (20250603000002_rls_policies.sql, "USERS: own row only"):
--
--   CREATE POLICY users_own ON users
--     USING (auth.uid() = id);
--
-- This policy has no `FOR` clause (defaults to ALL — SELECT/INSERT/UPDATE/
-- DELETE) and no `TO` clause (defaults to PUBLIC, i.e. anon too, though
-- auth.uid() is null for anon so that half is practically unreachable) and,
-- critically, no `WITH CHECK` clause. Per Postgres RLS semantics, when
-- WITH CHECK is omitted on a policy that also covers UPDATE, the USING
-- expression is reused as the check. USING only constrains WHICH ROW can be
-- touched (`auth.uid() = id`, i.e. "your own row") — it says nothing about
-- which COLUMNS or VALUES are allowed. So any authenticated candidate or
-- employer can run, directly against Supabase/Postgres (no application code
-- involved):
--
--   UPDATE public.users SET role = 'admin', status = 'active'
--   WHERE id = auth.uid();
--
-- This was empirically reproduced against this exact commit's real,
-- unmodified migrations in a rolled-back test transaction: the UPDATE
-- succeeds, and SELECT is_admin() immediately returns true afterward.
--
-- `users_admin` (20250603000006_rls_complete.sql) adds a second, correctly
-- strict policy (`FOR ALL ... USING (is_admin()) WITH CHECK (is_admin())`),
-- but Postgres RLS policies are PERMISSIVE and OR'd together by default —
-- users_admin is additive, not a replacement. users_own alone remains
-- sufficient to permit the self-promotion above for every authenticated
-- user, not just admins.
--
-- IMPACT: once an attacker's own `users.role` genuinely reads 'admin' (this
-- is a real row value, not a forged JWT claim), `public.is_admin()` returns
-- true, which is trusted by every is_admin()-gated RLS policy in this
-- database AND by the Next.js admin API's only authorization check
-- (requireAdminApi() -> getUserProfile(), which reads this exact column via
-- the RLS-bound client). This fully defeats the admin-review application
-- gate this project depends on: a self-promoted "admin" can read any
-- candidate's resume via the service-role-backed admin endpoint (which
-- performs no admin_review_status check of its own, by design, since real
-- admins are meant to see everything) and can approve/reject any
-- application directly. The existing freeze_moderation_columns() trigger
-- (20260930000003) does not stop this — it explicitly ALLOWS admins to
-- change moderation fields, and the attacker is now, fraudulently, one.
--
-- WHY A BARE "WITH CHECK (auth.uid() = id)" WOULD NOT FIX THIS: that check
-- only re-confirms the row is still the caller's own row after the update —
-- it does not look at which columns changed or to what values, so
-- `UPDATE users SET role='admin' WHERE id=auth.uid()` would still satisfy
-- `auth.uid() = id` both before and after the write and would still succeed.
--
-- FIX (two layers, both enforced at the database/RLS layer, neither
-- relying on Next.js/API code as the security boundary):
--
--   1. PRIMARY FIX — narrow self-service access on `users` to SELECT only.
--      An exhaustive search of this codebase found ZERO application code
--      path that performs a non-admin, non-service-role UPDATE/INSERT on
--      `public.users`: the signup INSERT runs via the SECURITY DEFINER
--      trigger handle_new_auth_user() (bypasses RLS entirely, unaffected by
--      this change); every UPDATE of role/status/email_verified (OTP email
--      verification, admin status changes, OAuth provisioning) runs via
--      `supabaseAdmin`, the service-role client (also bypasses RLS,
--      unaffected). The only genuine RLS-bound usage found is reading the
--      caller's own row (getSession(), getUserProfile() via
--      requireAdminApi() and others) — which remains fully supported by the
--      narrower SELECT-only policy below. Removing self UPDATE/INSERT/
--      DELETE capability on `users` therefore has no functional impact on
--      any existing candidate, employer, or admin flow: candidate and
--      employer profile edits are made on the separate `candidates` and
--      `employers` tables (already correctly protected), never on `users`
--      itself.
--
--   2. DEFENSE IN DEPTH — extend the existing freeze_moderation_columns()
--      trigger (the same mechanism this codebase already uses for exactly
--      this threat model on applications/jobs/employers) to also protect
--      `users.role` and `users.status` from any non-admin, non-service-role
--      UPDATE. This is redundant with fix #1 today (since no self-UPDATE
--      policy remains at all), but protects against a future regression —
--      e.g. a well-intentioned later migration re-adding a broader
--      self-service UPDATE policy on `users` for some legitimate column
--      (a display name, a notification preference) would still have
--      role/status explicitly frozen against non-admin callers, rather than
--      silently reopening this exact hole.
--
-- Neither change touches `users_admin`, `is_admin()`, service_role
-- behavior, or any other table's RLS — admin and service-role writes to
-- `users` are completely unaffected. Neither change introduces a new
-- cross-table subquery, so no RLS recursion is introduced (matching the
-- concern already fixed once in this codebase by
-- 20260930000002_fix_candidate_applications_rls_recursion.sql).

-- ---------------------------------------------------------------------------
-- 1. Replace the overly broad `users_own` (FOR ALL, no WITH CHECK) with a
--    SELECT-only self-access policy. No INSERT/UPDATE/DELETE self-service
--    policy is added, because none is needed (see rationale above).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_own ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. Defense in depth: extend freeze_moderation_columns() to also protect
--    users.role / users.status, mirroring the applications/jobs/employers
--    branches already present. CREATE OR REPLACE carries the full existing
--    function body forward unchanged except for the new ELSIF branch below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.freeze_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col text;
  protected_cols text[];
BEGIN
  -- auth.role() is Supabase's built-in function reading the request JWT's
  -- role claim; PostgREST sets it to 'service_role' for calls made with the
  -- Supabase service-role key (never exposed to the browser, used only by
  -- adminService.ts / cron routes), so this never blocks the admin API.
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'applications' THEN
    protected_cols := ARRAY['admin_review_status', 'admin_reviewed_at', 'admin_reviewed_by'];
  ELSIF TG_TABLE_NAME = 'jobs' THEN
    protected_cols := ARRAY['status', 'job_status', 'is_verified', 'is_featured', 'provenance', 'board', 'employer_id'];
  ELSIF TG_TABLE_NAME = 'employers' THEN
    protected_cols := ARRAY['verified', 'status'];
  ELSIF TG_TABLE_NAME = 'users' THEN
    protected_cols := ARRAY['role', 'status'];
  ELSE
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY protected_cols LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'column "%" on table "%" can only be changed by an admin or the service role', col, TG_TABLE_NAME
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.users;
CREATE TRIGGER freeze_moderation_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.freeze_moderation_columns();
