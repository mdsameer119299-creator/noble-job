-- RLS security fix, part 1 of 2 (2026-09-30): eliminate a real "infinite
-- recursion detected in policy" error that currently breaks EVERY
-- authenticated (non-service-role) read of `candidates`, `candidate_experience`,
-- `candidate_education` AND `applications` — discovered only by running the
-- repo's actual, unmodified migrations against a real Postgres instance and
-- issuing a plain `SELECT * FROM candidates LIMIT 1;` as an authenticated
-- user (see scripts/rls-security-test.ts and the RLS_SECURITY_FIX_REPORT for
-- the exact reproduction and its output). No existing test in this repo could
-- have caught this: every current test is a pure TypeScript/unit test with no
-- real database involved.
--
-- ROOT CAUSE: 20260929000002_application_admin_review_rls.sql added
-- `candidate_employer_applicant_select` (on `candidates`) and the matching
-- policies on `candidate_experience`/`candidate_education`, each with a raw
-- (non-SECURITY-DEFINER) `EXISTS (SELECT 1 FROM public.applications a ...)`
-- subquery. Evaluating that subquery requires Postgres to apply
-- `applications`' OWN RLS policies (app_candidate / app_candidate_insert),
-- which themselves subquery `candidates` (`candidate_id IN (SELECT id FROM
-- candidates WHERE user_id = auth.uid())`) — which requires applying
-- `candidates`' RLS policies again, including the very policy that started
-- the cycle. Postgres detects this circular policy dependency and refuses
-- the query outright with "infinite recursion detected in policy for
-- relation ...", rather than serving stale/wrong data.
--
-- IMPACT: this is not a security hole (Postgres correctly refuses to guess),
-- it is a functional outage. `src/lib/services/applicationService.ts` uses
-- the RLS-bound client (`createClient()`, not the service-role client) for
-- getApplicationsByCandidate/getApplicationsByEmployer — the candidate "My
-- Applications" page and the employer's own application-review view would
-- both hit this error in a real deployment, as would any other authenticated
-- read that touches `candidates` at all (even a candidate viewing their own
-- profile), since the cycle exists independently of which row is targeted.
--
-- FIX: exactly the SECURITY DEFINER pattern this codebase already uses for
-- the identical problem in storage RLS
-- (20250603000008_storage_rls_helpers.sql, "Break storage <-> candidates RLS
-- recursion via SECURITY DEFINER helpers") — move the `applications`-peeking
-- EXISTS check into a SECURITY DEFINER function. A SECURITY DEFINER function
-- runs with its owner's privileges, so the query INSIDE it does not itself
-- re-trigger RLS on `applications`/`employers`, which breaks the cycle while
-- keeping the exact same visibility rule (an employer may see a candidate's
-- profile/experience/education only via an application that is
-- admin_review_status IN ('approved','shared') for one of that employer's
-- own jobs — unchanged from what 20260929000002 already specified).
--
-- This migration changes WHICH FUNCTION evaluates an existing rule; it does
-- not loosen or add any new access.

CREATE OR REPLACE FUNCTION public.candidate_visible_to_employer(target_candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.applications a
    INNER JOIN public.employers e ON e.id = a.employer_id
    WHERE a.candidate_id = target_candidate_id
      AND a.admin_review_status IN ('approved', 'shared')
      AND e.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.candidate_visible_to_employer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_visible_to_employer(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS candidate_employer_applicant_select ON public.candidates;
CREATE POLICY candidate_employer_applicant_select ON public.candidates
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.candidate_visible_to_employer(candidates.id)
  );

DROP POLICY IF EXISTS candidate_experience_select ON public.candidate_experience;
CREATE POLICY candidate_experience_select ON public.candidate_experience
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
    OR public.candidate_visible_to_employer(candidate_experience.candidate_id)
  );

DROP POLICY IF EXISTS candidate_education_select ON public.candidate_education;
CREATE POLICY candidate_education_select ON public.candidate_education
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
    OR public.candidate_visible_to_employer(candidate_education.candidate_id)
  );
