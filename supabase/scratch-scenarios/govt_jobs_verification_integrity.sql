-- ============================================================================
-- Executable scenarios for the govt_jobs verification triggers.
--
--   Runs ONLY on a throwaway database named `govt_verification_scratch` (it refuses anything else). Never run it against
--   Supabase/production: it DROPs and recreates `govt_jobs` in whatever database it is pointed at, and the migrations it
--   loads COMMIT. Example (a local scratch cluster):
--
--     createdb govt_verification_scratch
--     psql -X -q -v ON_ERROR_STOP=1 -d govt_verification_scratch -f supabase/scratch-scenarios/govt_jobs_verification_integrity.sql
--
--   (Deliberately NOT under supabase/tests: `supabase test db` would pick that folder up and run it against a dev database.)
--   Run from the repository root (it \i-includes the migrations by relative path). Every check prints "PASS <label>";
--   any failure aborts with FAIL. The same scenarios are asserted statically in src/lib/data/govtVacancyEvidence.test.ts.
--
--   Order: (A) the already-applied 20260727000001 behaviour, demonstrating the gaps; (B) after the forward migration
--   20261026000001; (C) after its .down.sql the old behaviour is back.
-- ============================================================================
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF current_database() <> 'govt_verification_scratch' THEN
    RAISE EXCEPTION 'refusing to run: connected to "%", this script only runs on the throwaway database govt_verification_scratch', current_database();
  END IF;
END $$;

-- Scratch stand-in for govt_jobs: just the columns the trigger and the first migration read (types are irrelevant to the logic).
DROP TABLE IF EXISTS govt_jobs CASCADE;
CREATE TABLE govt_jobs (
  id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
  title text, org text, short text, post text, vacancies text, qualification text, age_range text, fee text,
  last_date text, start_date text, exam_date text, salary text, location text, state text, tab text, status text,
  notification_url text, official_url text, result_url text, admit_url text, answer_url text, notification_pdf text,
  apply_url text, overview text, eligibility text, age_limit text, salary_details text, exam_pattern text,
  syllabus_content text, article text, vacancy_breakup jsonb, fee_details text, important_dates jsonb, faqs jsonb,
  selection_process text, published boolean, review_status text
);

-- helper bodies reference columns the first migration adds, so they are validated at call time
SET check_function_bodies = off;

CREATE FUNCTION pg_temp.ok(cond boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL %', label; END IF;
  RAISE NOTICE 'PASS %', label;
END $$;

CREATE FUNCTION pg_temp.fails(stmt text, code text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code THEN RAISE NOTICE 'PASS % (rejected: %)', label, SQLERRM; RETURN; END IF;
    RAISE EXCEPTION 'FAIL %: expected SQLSTATE %, got % (%)', label, code, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL %: statement was accepted', label;
END $$;

-- a stable admin id of the real shape (auth.users.id), and helpers
CREATE FUNCTION pg_temp.admin() RETURNS text LANGUAGE sql AS $$ SELECT '3f8b2c1e-9a4d-4e6b-8c5a-7d2f1b0e9a64' $$;
CREATE FUNCTION pg_temp.cc(rid text) RETURNS timestamptz LANGUAGE sql AS $$ SELECT content_changed_at FROM govt_jobs WHERE id = rid $$;
CREATE FUNCTION pg_temp.va(rid text) RETURNS timestamptz LANGUAGE sql AS $$ SELECT verified_at FROM govt_jobs WHERE id = rid $$;
CREATE FUNCTION pg_temp.seed(rid text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO govt_jobs (id, title, org, post, vacancies, tab, status, published, created_at, content_changed_at)
  VALUES (rid, 'Test Recruitment', 'Test Org', 'Junior Engineer', '250', 'latest', 'active', true, '2026-06-12 15:29:28+00', '2026-06-12 15:29:28+00')
$$;

-- ============================ A. as applied today (20260727000001) ============================
\i supabase/migrations/20260727000001_govt_jobs_record_integrity.sql

SELECT pg_temp.seed('a1');
UPDATE govt_jobs SET vacancies = '9000', content_changed_at = '2020-01-01+00' WHERE id = 'a1';
SELECT pg_temp.ok(pg_temp.cc('a1') = '2020-01-01+00', 'A1 GAP (old trigger): a writer that supplies content_changed_at defeats the stamp');

SELECT pg_temp.seed('a2');
BEGIN;
  UPDATE govt_jobs SET vacancies = '9000' WHERE id = 'a2';
  UPDATE govt_jobs SET verified_by = pg_temp.admin(), verified_at = now() WHERE id = 'a2';
COMMIT;
SELECT pg_temp.ok(pg_temp.cc('a2') = pg_temp.va('a2'), 'A2 GAP (old trigger): edit and verification in one transaction carry the SAME instant (NOW() is transaction-stable)');

-- ============================ B. forward migration 20261026000001 ============================
\i supabase/migrations/20261026000001_govt_jobs_verification_integrity.sql

-- B1  caller-supplied content_changed_at is ignored on a public edit (older, and future)
SELECT pg_temp.seed('b1');
UPDATE govt_jobs SET vacancies = '9000', content_changed_at = '2020-01-01+00' WHERE id = 'b1';
SELECT pg_temp.ok(pg_temp.cc('b1') > '2026-06-12 15:29:28+00' AND pg_temp.cc('b1') <= clock_timestamp(), 'B1 an older supplied content_changed_at is ignored: the stamp is the database clock');
UPDATE govt_jobs SET vacancies = '9100', content_changed_at = '2099-01-01+00' WHERE id = 'b1';
SELECT pg_temp.ok(pg_temp.cc('b1') <= clock_timestamp(), 'B1b a future supplied content_changed_at is ignored too');

-- B2  with NO public change a writer cannot move content_changed_at at all (the "backwards to revalidate" attack)
SELECT pg_temp.seed('b2');
UPDATE govt_jobs SET vacancies = '9000' WHERE id = 'b2';
CREATE TEMP TABLE b2_stamp AS SELECT pg_temp.cc('b2') AS t;
UPDATE govt_jobs SET content_changed_at = '2020-01-01+00' WHERE id = 'b2';
SELECT pg_temp.ok(pg_temp.cc('b2') = (SELECT t FROM b2_stamp), 'B2 moving content_changed_at backwards without an edit does nothing');
UPDATE govt_jobs SET content_changed_at = '2099-01-01+00', record_type = 'other' WHERE id = 'b2';
SELECT pg_temp.ok(pg_temp.cc('b2') = (SELECT t FROM b2_stamp), 'B2b moving it forwards (with a non-content change) does nothing either');

-- B3  one statement cannot edit public content AND record a verification (any of the verification columns)
SELECT pg_temp.seed('b3');
SELECT pg_temp.fails($q$UPDATE govt_jobs SET vacancies = '9000', verified_by = pg_temp.admin(), verified_at = now() WHERE id = 'b3'$q$, '23514', 'B3 edit + verify in ONE statement is rejected');
SELECT pg_temp.fails($q$UPDATE govt_jobs SET vacancies = '9000', verified_by = pg_temp.admin() WHERE id = 'b3'$q$, '23514', 'B3b edit + verified_by only is rejected');
SELECT pg_temp.fails($q$UPDATE govt_jobs SET post = 'Senior Engineer', verified_at = now(), verified_by = pg_temp.admin(), content_changed_at = '2020-01-01+00' WHERE id = 'b3'$q$, '23514', 'B3c edit + verify + forged content_changed_at is rejected');
SELECT pg_temp.ok((SELECT vacancies = '250' AND verified_by IS NULL FROM govt_jobs WHERE id = 'b3'), 'B3d the rejected statements changed nothing');

-- B4  edit then verify (two statements, even in one transaction): never an equal instant, verification is strictly later
SELECT pg_temp.seed('b4');
BEGIN;
  UPDATE govt_jobs SET vacancies = '9000' WHERE id = 'b4';
  UPDATE govt_jobs SET verified_by = pg_temp.admin(), verified_at = now() WHERE id = 'b4';
COMMIT;
SELECT pg_temp.ok(pg_temp.cc('b4') < pg_temp.va('b4'), 'B4 same-transaction edit then verify: content_changed_at < verified_at (strict, no equal instant)');

-- B5  verified_at comes from the database clock, whatever the caller sent
SELECT pg_temp.seed('b5');
UPDATE govt_jobs SET verified_by = pg_temp.admin(), verified_at = '2020-01-01+00' WHERE id = 'b5';
SELECT pg_temp.ok(pg_temp.va('b5') > '2026-06-12 15:29:28+00' AND pg_temp.va('b5') <= clock_timestamp(), 'B5 a back-dated verified_at is replaced by the database clock');
UPDATE govt_jobs SET verified_by = pg_temp.admin(), verified_at = '2099-01-01+00' WHERE id = 'b5';
SELECT pg_temp.ok(pg_temp.va('b5') <= clock_timestamp(), 'B5b a forward-dated verified_at is replaced too');
SELECT pg_temp.ok(pg_temp.cc('b5') = '2026-06-12 15:29:28+00', 'B5c verifying does not touch content_changed_at');

-- B6  edit after a verification: stamp is strictly later, the old verification stays recorded (and is stale)
UPDATE govt_jobs SET vacancies = '77' WHERE id = 'b5';
SELECT pg_temp.ok(pg_temp.cc('b5') > pg_temp.va('b5') AND (SELECT verified_by FROM govt_jobs WHERE id = 'b5') = pg_temp.admin(), 'B6 a later edit makes content_changed_at > verified_at; verified_* kept');

-- B7  re-verification: needs a new verified_at value; identical values change nothing
UPDATE govt_jobs SET verified_by = pg_temp.admin(), verified_at = va FROM (SELECT pg_temp.va('b5') AS va) s WHERE id = 'b5';
SELECT pg_temp.ok(pg_temp.cc('b5') > pg_temp.va('b5'), 'B7 re-writing the IDENTICAL verification is a no-op (still stale)');
UPDATE govt_jobs SET verified_by = pg_temp.admin(), verified_at = now() WHERE id = 'b5';
SELECT pg_temp.ok(pg_temp.cc('b5') < pg_temp.va('b5'), 'B7b a fresh verified_at re-verifies after the edit');

-- B8  un-verifying alongside an edit is allowed
UPDATE govt_jobs SET vacancies = '88', verified_by = NULL, verified_at = NULL WHERE id = 'b5';
SELECT pg_temp.ok((SELECT verified_by IS NULL AND verified_at IS NULL FROM govt_jobs WHERE id = 'b5'), 'B8 clearing a verification together with an edit is allowed');

-- B9  inserts
SELECT pg_temp.fails($q$INSERT INTO govt_jobs (id, title, verified_by) VALUES ('b9', 't', pg_temp.admin())$q$, '23514', 'B9 a row cannot be INSERTed already verified (verified_by)');
SELECT pg_temp.fails($q$INSERT INTO govt_jobs (id, title, verified_at) VALUES ('b9', 't', now())$q$, '23514', 'B9b a row cannot be INSERTed already verified (verified_at)');
INSERT INTO govt_jobs (id, title) VALUES ('b9c', 't');
SELECT pg_temp.ok(pg_temp.cc('b9c') IS NOT NULL, 'B9c a plain insert still defaults content_changed_at');

-- B10  the ingestion upsert (INSERT … ON CONFLICT DO UPDATE with an explicit content_changed_at, no verified_* in the payload)
SELECT pg_temp.seed('b10');
UPDATE govt_jobs SET verified_by = pg_temp.admin() WHERE id = 'b10';
CREATE TEMP TABLE b10_v AS SELECT pg_temp.va('b10') AS v, pg_temp.cc('b10') AS c;
INSERT INTO govt_jobs (id, title, vacancies, content_changed_at) VALUES ('b10', 'Test Recruitment', '250', '2030-01-01+00')
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, vacancies = EXCLUDED.vacancies, content_changed_at = EXCLUDED.content_changed_at;
SELECT pg_temp.ok(pg_temp.cc('b10') = (SELECT c FROM b10_v) AND pg_temp.va('b10') = (SELECT v FROM b10_v), 'B10 an upsert that changes NO public column leaves content_changed_at and the verification untouched');
INSERT INTO govt_jobs (id, title, vacancies, content_changed_at) VALUES ('b10', 'Test Recruitment', '9000', '2000-01-01+00')
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, vacancies = EXCLUDED.vacancies, content_changed_at = EXCLUDED.content_changed_at;
SELECT pg_temp.ok(pg_temp.cc('b10') > pg_temp.va('b10') AND pg_temp.cc('b10') <= clock_timestamp(), 'B10b an upsert that changes vacancies stamps the clock (supplied value ignored) and invalidates the verification');

-- B11  the clock-skew guard: even if an earlier verified_at is somehow AHEAD of the clock, an edit is stamped after it
SELECT pg_temp.seed('b11');
ALTER TABLE govt_jobs DISABLE TRIGGER trg_govt_jobs_content_changed;
UPDATE govt_jobs SET verified_by = pg_temp.admin(), verified_at = clock_timestamp() + interval '1 hour' WHERE id = 'b11';
ALTER TABLE govt_jobs ENABLE TRIGGER trg_govt_jobs_content_changed;
UPDATE govt_jobs SET vacancies = '9000' WHERE id = 'b11';
SELECT pg_temp.ok(pg_temp.cc('b11') > pg_temp.va('b11'), 'B11 an edit is stamped strictly after even a forward-dated verified_at');

-- ============================ C. rollback restores the 20260727000001 behaviour ============================
\i supabase/migrations/20261026000001_govt_jobs_verification_integrity.down.sql
SELECT pg_temp.seed('c1');
UPDATE govt_jobs SET vacancies = '9000', content_changed_at = '2020-01-01+00' WHERE id = 'c1';
SELECT pg_temp.ok(pg_temp.cc('c1') = '2020-01-01+00', 'C1 after the down migration the old behaviour is back (supplied value wins)');
INSERT INTO govt_jobs (id, title, verified_by) VALUES ('c2', 't', 'x');
SELECT pg_temp.ok(true, 'C2 after the down migration a row may be inserted with verified_by again');

\echo
\echo 'ALL SCENARIOS PASSED'
