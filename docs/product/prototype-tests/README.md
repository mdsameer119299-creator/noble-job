# Prototype HTTP tests (evidence only, not product code)

`app.mjs` is a throwaway Request→Response prototype of the proposed anonymous-resume routes (upload, status, delete, claim, purge) with a filesystem-backed storage adapter and a stubbed session. `test.mjs` drives it over real HTTP against a local scratch Postgres that has all 34 migrations plus `../proposed-migrations/20261121000002_anonymous_resumes.sql`. `results.txt` is the output (73 passed, 0 failed; run 4 times, no flakiness).

Limits of this evidence: the session is a stub (not Supabase Auth) and storage is a local directory (not Supabase Storage). Real Supabase Storage deletion and Auth behaviour must be re-verified on staging (see proposal section 3.3 and 6). Nothing here is wired into `src/`, built, or deployed.

Run: `node test.mjs` (needs the `postgres` npm package and a scratch DB on port 5555).
