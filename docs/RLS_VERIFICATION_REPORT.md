# RLS verification report

## Apply migrations

Run in Supabase SQL Editor (order):

1. `001_initial_schema.sql`
2. `002_rls_policies.sql`
3. `003_indexes.sql`
4. `004_functions.sql`
5. `005_triggers.sql`
6. `006_rls_complete.sql` ← **complete RLS** (run before or after `006_storage_resumes.sql`; independent)
7. `006_storage_resumes.sql` ← private resume bucket

## Verify

```bash
npm run verify:rls
```

Calls `public.get_rls_audit()` (service role) and prints per-table:

| Column | Meaning |
|--------|---------|
| RLS | `relrowsecurity` enabled on table |
| Policies | Count of `pg_policies` for `public` schema |
| Expected | Minimum policies after `006_rls_complete` |
| Result | `PASS` / `FAIL: …` |

## Policy summary (006_rls_complete)

| Table | New / updated policies |
|-------|-------------------------|
| `saved_jobs` | select, insert, update, delete (candidate own) |
| `bookmarks` | select, insert, delete (user own) |
| `job_alerts` | select, insert (auth + anon), update |
| `interviews` | select, insert, update (employer/candidate/admin) |
| `notifications` | select, update, insert (replaces `notif_own`) |
| `messages` | select, insert, update (replaces `msg_own`) |
| `employer_settings` | select, insert, update |
| `employer_plans` | select, admin write |
| `candidate_experience` | select (incl. employer applicants), write (candidate) |
| `candidate_education` | select (incl. employer applicants), write (candidate) |
| `ratings` | insert (anon/auth), select own |
| `site_content` | public read, admin write |
| Plus | `applications` insert/update, `candidates` employer read + update, admin overrides, catalogue tables, `contact_messages`, `otp_tokens` (RLS, no policies), `get_rls_audit()` RPC |

## Manual SQL

```sql
SELECT * FROM public.get_rls_audit();
```

## Expected results (all PASS)

After migration, every audited table should show `test_result = PASS`. Special case: `otp_tokens` — RLS on, **0** policies (service role only).
