/**
 * rls-security-test.ts — genuine, behavioral, database-level RLS security tests.
 *
 * Unlike this repo's existing unit tests (which exercise TypeScript logic with
 * no database involved) and unlike verify-rls.mjs (which only checks that RLS
 * is *enabled* and that a *policy count* meets a minimum), this script proves
 * actual row/column-level behavior against a REAL Postgres instance running
 * this repo's REAL migrations unmodified: it opens a session as a specific
 * authenticated user (or the service role) exactly the way PostgREST/Supabase
 * does — `SET LOCAL ROLE`, `SET LOCAL request.jwt.claim.sub` — and asserts
 * whether a mutation/read that SHOULD be denied actually IS denied, and one
 * that should succeed actually DOES.
 *
 * This is the direct, literal proof the 2026-09-30 production-readiness audit
 * asked for: "Even if a malicious employer bypasses the Noble Job frontend
 * and directly talks to Supabase/Postgres, they STILL CANNOT approve an
 * application or obtain a candidate resume before admin approval."
 *
 * IMPORTANT — this NEVER runs against a live/production Supabase project. It
 * requires TEST_DATABASE_URL to point at a disposable Postgres instance that
 * already has this repo's migrations (supabase/migrations/*.sql, in order)
 * applied, plus a minimal auth/storage schema stub and the fixture rows the
 * audit's harness created (see the audit's scripts/rls-harness/ directory for
 * the exact bootstrap this was developed and verified against). Running it
 * with no TEST_DATABASE_URL set is a clean, intentional no-op — it will never
 * accidentally touch a real database.
 *
 * Usage:
 *   TEST_DATABASE_URL=postgres://postgres:PASSWORD@127.0.0.1:5432/noble_job_rls_test \
 *     npx tsx scripts/rls-security-test.ts
 */
import postgres from "postgres"

const DB_URL = process.env.TEST_DATABASE_URL

if (!DB_URL) {
  console.log("SKIP: TEST_DATABASE_URL not set — this script only runs against a disposable local/CI Postgres instance, never production.")
  process.exit(0)
}

// Fixture identities (see scripts/rls-harness/02_fixtures.sql). Candidate/employer
// row ids are looked up at runtime since they are trigger-generated (not fixed),
// exactly like a real signup.
const AUTH_UID = {
  admin: "00000000-0000-0000-0000-00000000a001",
  employerA: "00000000-0000-0000-0000-00000000e001",
  employerB: "00000000-0000-0000-0000-00000000e002",
  candidateA: "00000000-0000-0000-0000-00000000c001",
  candidateB: "00000000-0000-0000-0000-00000000c002",
} as const
const JOB_ID = "00000000-0000-0000-0000-00000000b001"
const APPLICATION_ID = "00000000-0000-0000-0000-00000000d001"

type Role = "anon" | "authenticated" | "service_role"
type Outcome = { allowed: boolean; rows: number; error?: string }

let passed = 0
let failed = 0
const results: { name: string; expect: "ALLOW" | "DENY"; got: Outcome; ok: boolean }[] = []

async function main() {
  const sql = postgres(DB_URL!, { max: 1 })

  /** Run `fn` inside a transaction impersonating `role`/`sub` exactly like PostgREST does, then always roll back — fixture state never drifts between tests. */
  async function as<T>(role: Role, sub: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<{ result?: T; error?: string }> {
    try {
      let out: T | undefined
      await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE ${role}`)
        await tx.unsafe(`SET LOCAL request.jwt.claim.role = '${role}'`)
        if (sub) await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${sub}'`)
        out = await fn(tx)
        throw { __rollback: true } // always undo — this is a probe, not a real mutation
      })
      return { result: out }
    } catch (e: any) {
      if (e?.__rollback) return { result: undefined } // fn ran, no SQL error — success path below reads via a fresh read if needed
      return { error: String(e?.message ?? e) }
    }
  }

  /** UPDATE probe: returns rows-affected count (0 = denied by USING; error = denied by WITH CHECK/trigger). */
  async function probeUpdate(role: Role, sub: string, updateSql: (tx: postgres.TransactionSql) => Promise<{ count: number }>): Promise<Outcome> {
    let rows = 0
    const { error } = await as(role, sub, async (tx) => {
      const r = await updateSql(tx)
      rows = r.count
    })
    if (error) return { allowed: false, rows: 0, error }
    return { allowed: rows > 0, rows }
  }

  /** SELECT probe: returns row count visible. */
  async function probeSelect(role: Role, sub: string | null, selectSql: (tx: postgres.TransactionSql) => postgres.PendingQuery<any> | Promise<unknown[]>): Promise<Outcome> {
    let rows = 0
    const { error } = await as(role, sub, async (tx) => {
      const r = await selectSql(tx)
      rows = r.length
    })
    if (error) return { allowed: false, rows: 0, error }
    return { allowed: rows > 0, rows }
  }

  /** INSERT probe. */
  async function probeInsert(role: Role, sub: string, insertSql: (tx: postgres.TransactionSql) => Promise<{ count: number }>): Promise<Outcome> {
    let rows = 0
    const { error } = await as(role, sub, async (tx) => {
      const r = await insertSql(tx)
      rows = r.count
    })
    if (error) return { allowed: false, rows: 0, error }
    return { allowed: rows > 0, rows }
  }

  function check(name: string, expect: "ALLOW" | "DENY", got: Outcome) {
    const ok = expect === "ALLOW" ? got.allowed : !got.allowed
    results.push({ name, expect, got, ok })
    if (ok) passed++
    else failed++
    const label = ok ? "PASS" : "FAIL"
    const detail = got.error ? `denied (${got.error.slice(0, 90)})` : `${got.allowed ? "ALLOWED" : "DENIED"} (${got.rows} row(s))`
    console.log(`  ${label}  [${expect}]  ${name}\n        -> ${detail}`)
  }

  // ---- resolve trigger-generated ids -----------------------------------
  const candidateA = (await sql`SELECT id FROM public.candidates WHERE user_id = ${AUTH_UID.candidateA}`)[0]?.id
  const candidateB = (await sql`SELECT id FROM public.candidates WHERE user_id = ${AUTH_UID.candidateB}`)[0]?.id
  const employerA = (await sql`SELECT id FROM public.employers WHERE user_id = ${AUTH_UID.employerA}`)[0]?.id
  const employerB = (await sql`SELECT id FROM public.employers WHERE user_id = ${AUTH_UID.employerB}`)[0]?.id
  if (!candidateA || !candidateB || !employerA || !employerB) {
    console.error("FATAL: fixtures not found — run scripts/rls-harness/02_fixtures.sql first.")
    process.exit(1)
  }

  console.log(`\nRLS security test suite — against ${DB_URL!.replace(/:[^:@]*@/, ":***@")}\n`)

  // ===================== TEST 1 =====================
  check("TEST 1: candidate creates own application (insert)", "ALLOW",
    await probeInsert("authenticated", AUTH_UID.candidateB, async (tx) => {
      const r = await tx`
        INSERT INTO public.applications (job_id, candidate_id, employer_id, board, admin_review_status)
        VALUES (${JOB_ID}, ${candidateB}, ${employerA}, 'private', 'pending_review')`
      return { count: r.count }
    }))

  // ===================== TEST 2 =====================
  check("TEST 2: candidate attempts to approve OWN application (admin_review_status)", "DENY",
    await probeUpdate("authenticated", AUTH_UID.candidateA, async (tx) => {
      const r = await tx`UPDATE public.applications SET admin_review_status = 'approved' WHERE id = ${APPLICATION_ID}`
      return { count: r.count }
    }))

  // ===================== TEST 3 =====================
  check("TEST 3: candidate attempts to modify admin_review_status (any value)", "DENY",
    await probeUpdate("authenticated", AUTH_UID.candidateA, async (tx) => {
      const r = await tx`UPDATE public.applications SET admin_review_status = 'shared' WHERE id = ${APPLICATION_ID}`
      return { count: r.count }
    }))

  // ===================== TEST 4 =====================
  check("TEST 4: candidate attempts to modify admin_reviewed_by (impersonate review)", "DENY",
    await probeUpdate("authenticated", AUTH_UID.candidateA, async (tx) => {
      const r = await tx`UPDATE public.applications SET admin_reviewed_by = ${AUTH_UID.candidateA} WHERE id = ${APPLICATION_ID}`
      return { count: r.count }
    }))

  // ===================== TEST 5 =====================
  check("TEST 5: employer attempts to approve an application for their own job", "DENY",
    await probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
      const r = await tx`UPDATE public.applications SET admin_review_status = 'approved' WHERE id = ${APPLICATION_ID}`
      return { count: r.count }
    }))

  // ===================== TEST 6 =====================
  check("TEST 6: employer attempts to modify admin_review_status to 'shared'", "DENY",
    await probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
      const r = await tx`UPDATE public.applications SET admin_review_status = 'shared' WHERE id = ${APPLICATION_ID}`
      return { count: r.count }
    }))

  // ===================== TEST 7 =====================
  check("TEST 7: employer attempts to modify admin_reviewed_by / admin_reviewed_at", "DENY",
    await probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
      const r = await tx`UPDATE public.applications SET admin_reviewed_by = ${AUTH_UID.employerA}, admin_reviewed_at = now() WHERE id = ${APPLICATION_ID}`
      return { count: r.count }
    }))

  // ===================== TEST 8 =====================
  check("TEST 8: employer attempts to READ an unapproved application (admin_review_status='pending_review')", "DENY",
    await probeSelect("authenticated", AUTH_UID.employerA, (tx) =>
      tx`SELECT * FROM public.applications WHERE id = ${APPLICATION_ID}`))

  // ===================== TEST 9 =====================
  // Queries storage.objects directly with NO hand-written join logic — this
  // relies entirely on the REAL, migrated `resumes_employer_select_applicant`
  // policy (storage_resume_employer_applicant(), which additionally requires
  // e.verified = true, per 20260929000002_application_admin_review_rls.sql).
  check("TEST 9: employer attempts to access the candidate's resume object before approval", "DENY",
    await probeSelect("authenticated", AUTH_UID.employerA, (tx) =>
      tx`SELECT * FROM storage.objects WHERE bucket_id = 'resumes'`))

  // ===================== TEST 10 (admin path — setup for 11/12) =====================
  const adminApprove = await probeUpdate("authenticated", AUTH_UID.admin, async (tx) => {
    const r = await tx`UPDATE public.applications SET admin_review_status = 'approved', admin_reviewed_by = ${AUTH_UID.admin}, admin_reviewed_at = now() WHERE id = ${APPLICATION_ID}`
    return { count: r.count }
  })
  check("TEST 10: admin approves the application", "ALLOW", adminApprove)

  // Actually persist the admin's legitimate work (outside a rolled-back probe)
  // so TESTS 11/12 can observe employer access AFTER a genuine approval —
  // resume access requires BOTH admin_review_status approved/shared AND the
  // employer being verified (also an admin-only action), so verify Employer A
  // here too, exactly as a real admin would before any resume becomes visible.
  //
  // This must run AS service_role (matching how the real Next.js admin API's
  // supabaseAdmin client performs these writes), not as the bare `postgres`
  // superuser connection: the freeze_moderation_columns() trigger fires for
  // EVERY role (BYPASSRLS only skips RLS policy evaluation, never triggers —
  // see the migration's header comment), and a plain, unauthenticated `sql`
  // call carries no request.jwt.claim.role/sub, so auth.role() and is_admin()
  // both resolve to NULL/false and the trigger correctly rejects it. Setting
  // the service_role context here is not a workaround for the trigger — it is
  // the same context boundary a real deployment's admin-approval code path
  // actually runs under.
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE service_role`)
    await tx.unsafe(`SET LOCAL request.jwt.claim.role = 'service_role'`)
    await tx`UPDATE public.applications SET admin_review_status = 'approved', admin_reviewed_by = ${AUTH_UID.admin}, admin_reviewed_at = now() WHERE id = ${APPLICATION_ID}`
    await tx`UPDATE public.employers SET verified = true WHERE id = ${employerA}`
  })

  // ===================== TEST 11 =====================
  check("TEST 11: employer can now see the approved/released application", "ALLOW",
    await probeSelect("authenticated", AUTH_UID.employerA, (tx) =>
      tx`SELECT * FROM public.applications WHERE id = ${APPLICATION_ID}`))

  // ===================== TEST 12 =====================
  check("TEST 12: employer can access the resume only AFTER legitimate approval + verification", "ALLOW",
    await probeSelect("authenticated", AUTH_UID.employerA, (tx) =>
      tx`SELECT * FROM storage.objects WHERE bucket_id = 'resumes'`))

  // ===================== TEST 13 =====================
  check("TEST 13: Employer B cannot access Employer A's released application", "DENY",
    await probeSelect("authenticated", AUTH_UID.employerB, (tx) =>
      tx`SELECT * FROM public.applications WHERE id = ${APPLICATION_ID}`))

  // ===================== TEST 14 =====================
  check("TEST 14: Candidate B cannot access Candidate A's application", "DENY",
    await probeSelect("authenticated", AUTH_UID.candidateB, (tx) =>
      tx`SELECT * FROM public.applications WHERE id = ${APPLICATION_ID}`))

  // ===================== TEST 15 =====================
  // The literal exploit: an employer's own authenticated session, calling
  // Postgres directly (exactly what supabase-js does under the hood) —
  // never through the Next.js API — attempting to self-approve.
  check("TEST 15: direct database mutation cannot bypass the admin-review gate (employer self-approves a SECOND, still-pending application)", "DENY",
    await (async () => {
      // Use the application TEST 1 created (still pending_review) so this is
      // independent of TEST 10's already-approved row.
      const pending = await sql`SELECT id FROM public.applications WHERE job_id = ${JOB_ID} AND candidate_id = ${candidateB} AND admin_review_status = 'pending_review'`
      if (!pending.length) {
        // TEST 1 ran inside a rolled-back transaction, so it never persisted —
        // create the fixture for real here, then attempt the bypass.
        await sql`INSERT INTO public.applications (job_id, candidate_id, employer_id, board, admin_review_status) VALUES (${JOB_ID}, ${candidateB}, ${employerA}, 'private', 'pending_review') ON CONFLICT (job_id, candidate_id) DO NOTHING`
      }
      const row = (await sql`SELECT id FROM public.applications WHERE job_id = ${JOB_ID} AND candidate_id = ${candidateB}`)[0]
      return probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
        const r = await tx`UPDATE public.applications SET admin_review_status = 'approved' WHERE id = ${row.id}`
        return { count: r.count }
      })
    })())

  // ===================== BONUS: employers/jobs self-mutation coverage =====================
  // Uses Employer B (not A): by this point in the script, Employer A's
  // `verified` column has already been legitimately flipped to true by the
  // admin-persisted step above (for TESTS 11/12), so a same-value "change" to
  // `true` on Employer A would be a no-op regardless of the trigger (NEW and
  // OLD would be identical) and would not actually exercise the freeze. Employer
  // B's `verified` is still false at this point, so this is a genuine attempted
  // state change.
  check("BONUS: employer self-verifies (employers.verified = true)", "DENY",
    await probeUpdate("authenticated", AUTH_UID.employerB, async (tx) => {
      const r = await tx`UPDATE public.employers SET verified = true WHERE id = ${employerB}`
      return { count: r.count }
    }))

  check("BONUS: employer self-activates their own private job (status/is_verified/is_featured/provenance)", "DENY",
    await probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
      const r = await tx`UPDATE public.jobs SET status = 'active', is_verified = true, is_featured = true WHERE id = ${JOB_ID}`
      return { count: r.count }
    }))

  check("BONUS: employer can still legitimately edit non-moderation job fields (title/description)", "ALLOW",
    await probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
      const r = await tx`UPDATE public.jobs SET title = 'Senior Backend Engineer', description = 'Updated JD' WHERE id = ${JOB_ID}`
      return { count: r.count }
    }))

  check("BONUS: admin CAN set jobs.status/is_verified (moderation still works for real admins)", "ALLOW",
    await probeUpdate("authenticated", AUTH_UID.admin, async (tx) => {
      const r = await tx`UPDATE public.jobs SET status = 'active', is_verified = true WHERE id = ${JOB_ID}`
      return { count: r.count }
    }))

  check("BONUS: service_role (Next.js admin API) can still set admin_review_status directly", "ALLOW",
    await probeUpdate("service_role", AUTH_UID.admin, async (tx) => {
      const r = await tx`UPDATE public.applications SET admin_review_status = 'rejected' WHERE id = ${APPLICATION_ID}`
      return { count: r.count }
    }))

  // ===================== users.role / users.status privilege-escalation regression (2026-10-01) =====================
  // Exploit originally reproduced by the production-readiness audit of commit
  // 36cc9bb: the pre-fix `users_own` policy (FOR ALL, no WITH CHECK) let any
  // authenticated candidate/employer directly UPDATE their own `role`/`status`
  // to 'admin'/'active' — immediately satisfying is_admin() and fully
  // defeating the admin-review gate this entire suite otherwise proves.
  // Fixed by 20261001000001_fix_users_role_escalation.sql: `users_own` is
  // replaced with a SELECT-only self-access policy, and
  // freeze_moderation_columns() is extended to also protect users.role/status
  // as defense in depth.

  check("TEST 16: candidate cannot self-promote role to admin (the originally-reproduced exploit)", "DENY",
    await probeUpdate("authenticated", AUTH_UID.candidateA, async (tx) => {
      const r = await tx`UPDATE public.users SET role = 'admin', status = 'active' WHERE id = ${AUTH_UID.candidateA}`
      return { count: r.count }
    }))

  // Fresh, never-activated accounts (status defaults to 'pending' via
  // handle_new_auth_user()) isolate a pure status-only mutation attempt,
  // independent of TEST 16/18's role change on an already-active account.
  const pendingCandidateUid = "00000000-0000-0000-0000-00000000c901"
  const pendingEmployerUid = "00000000-0000-0000-0000-00000000e901"
  await sql`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      (${pendingCandidateUid}, 'pending-candidate@test.local', '{"role":"candidate","first_name":"Pending","last_name":"Cand"}'::jsonb),
      (${pendingEmployerUid}, 'pending-employer@test.local', '{"role":"employer","company_name":"Pending Employer Co"}'::jsonb)
    ON CONFLICT (id) DO NOTHING`

  check("TEST 17: a never-activated candidate cannot self-activate status (pending -> active)", "DENY",
    await probeUpdate("authenticated", pendingCandidateUid, async (tx) => {
      const r = await tx`UPDATE public.users SET status = 'active' WHERE id = ${pendingCandidateUid}`
      return { count: r.count }
    }))

  check("TEST 18: employer cannot self-promote role to admin", "DENY",
    await probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
      const r = await tx`UPDATE public.users SET role = 'admin', status = 'active' WHERE id = ${AUTH_UID.employerA}`
      return { count: r.count }
    }))

  check("TEST 19: a never-activated employer cannot self-activate status (pending -> active)", "DENY",
    await probeUpdate("authenticated", pendingEmployerUid, async (tx) => {
      const r = await tx`UPDATE public.users SET status = 'active' WHERE id = ${pendingEmployerUid}`
      return { count: r.count }
    }))

  check("TEST 20: a forged attempt to self-suspend/re-mutate status on an already-active candidate is still denied (not a role-change special case)", "DENY",
    await probeUpdate("authenticated", AUTH_UID.candidateB, async (tx) => {
      const r = await tx`UPDATE public.users SET status = 'suspended' WHERE id = ${AUTH_UID.candidateB}`
      return { count: r.count }
    }))

  // is_admin() must read false for an ordinary candidate both before and
  // after every escalation attempt above (none of which persisted, since
  // probeUpdate always rolls back — this re-confirms in a fresh probe).
  await (async () => {
    let isAdminValue: unknown
    const { error } = await as("authenticated", AUTH_UID.candidateA, async (tx) => {
      const r = await tx`SELECT is_admin() AS v`
      isAdminValue = r[0]?.v
    })
    check("TEST 21: is_admin() remains false for an ordinary candidate after escalation attempts", "DENY", {
      allowed: Boolean(isAdminValue),
      rows: isAdminValue ? 1 : 0,
      error,
    })
  })()

  check("TEST 22: candidate CAN still update their own legitimate profile field (candidates.first_name) — the fix does not break candidate profile editing", "ALLOW",
    await probeUpdate("authenticated", AUTH_UID.candidateA, async (tx) => {
      const r = await tx`UPDATE public.candidates SET first_name = 'Updated' WHERE id = ${candidateA}`
      return { count: r.count }
    }))

  check("TEST 23: employer CAN still update their own legitimate profile field (employers.company_name) — the fix does not break employer profile editing", "ALLOW",
    await probeUpdate("authenticated", AUTH_UID.employerA, async (tx) => {
      const r = await tx`UPDATE public.employers SET company_name = 'Updated Co' WHERE id = ${employerA}`
      return { count: r.count }
    }))

  check("TEST 24: a genuine admin CAN legitimately change another user's role/status (activating the pending employer)", "ALLOW",
    await probeUpdate("authenticated", AUTH_UID.admin, async (tx) => {
      const r = await tx`UPDATE public.users SET status = 'active' WHERE id = ${pendingEmployerUid}`
      return { count: r.count }
    }))

  check("TEST 25: service_role CAN still perform required backend updates to users.status (mirrors the real OTP email-verification flow)", "ALLOW",
    await probeUpdate("service_role", pendingCandidateUid, async (tx) => {
      const r = await tx`UPDATE public.users SET status = 'active', email_verified = true WHERE id = ${pendingCandidateUid}`
      return { count: r.count }
    }))

  // Candidate-visibility RLS (the recursion-fixed path) must still work after
  // this change: an employer with a genuine approved/shared application can
  // still read the candidate's profile directly from `candidates` — and the
  // mere fact every query in this script, including this one and the plain
  // `candidates` reads threaded through probeSelect elsewhere, executed
  // without a Postgres "infinite recursion detected in policy" error is
  // itself the proof that no recursion was reintroduced by this migration
  // (it touches only `users`, which no candidate/application policy queries).
  check("TEST 26: employer can still read an approved candidate's profile directly (candidate-visibility RLS / recursion fix unaffected)", "ALLOW",
    await probeSelect("authenticated", AUTH_UID.employerA, (tx) =>
      tx`SELECT * FROM public.candidates WHERE id = ${candidateA}`))

  // ===================== TEST 27: defense-in-depth trigger, isolated from the SELECT-only RLS layer (2026-10-01) =====================
  // TEST 16/18 already prove the exploit is denied TODAY. But today it is
  // denied by the PRIMARY layer alone (users_select_own grants no UPDATE at
  // all to `authenticated`, so RLS filters the row out before any trigger
  // ever fires). That leaves an open question: does freeze_moderation_columns()
  // actually work as independent defense-in-depth, or would it be a no-op if
  // some future migration ever re-opened a self-service UPDATE policy on
  // `users`? This test isolates exactly that: it temporarily grants
  // `authenticated` an UPDATE-capable policy on their own `users` row INSIDE
  // A SINGLE TRANSACTION THAT ALWAYS ROLLS BACK, then attempts the same two
  // escalations through that hypothetical policy. Only the trigger stands
  // between the attempt and success here.
  //
  // Nothing here touches supabase/migrations/*.sql, the permanent schema, or
  // survives past this one transaction: the temporary policy is created (as
  // the unrestricted table-owner connection, before switching into the
  // `authenticated` role) and dropped automatically the instant the
  // transaction aborts -- the exact same rollback-always pattern the `as()`
  // helper above uses for every other probe in this file. This never runs
  // anywhere but TEST_DATABASE_URL (the disposable local Postgres instance).
  await (async () => {
    // Role-escalation target: an already-active candidate (role genuinely
    // changes candidate -> admin). Status-escalation target: the SAME
    // never-activated candidate fixture TEST 17 uses (status genuinely
    // changes pending -> active). Using a row whose current value already
    // equals the target value would make the UPDATE a harmless no-op --
    // freeze_moderation_columns() only raises when `to_jsonb(NEW) -> col
    // IS DISTINCT FROM to_jsonb(OLD) -> col`, i.e. the value actually
    // changes -- so each attempt below is a genuine value change.
    const roleTestUid = AUTH_UID.candidateA
    const statusTestUid = pendingCandidateUid
    let preRole: string | undefined, postRole: string | undefined
    let preStatus: string | undefined, postStatus: string | undefined
    let roleAttemptRows = 0, roleAttemptError: string | undefined
    let statusAttemptRows = 0, statusAttemptError: string | undefined
    let isAdminAfter: unknown

    try {
      await sql.begin(async (tx) => {
        const beforeRole = await tx`SELECT role FROM public.users WHERE id = ${roleTestUid}`
        preRole = beforeRole[0]?.role
        const beforeStatus = await tx`SELECT status FROM public.users WHERE id = ${statusTestUid}`
        preStatus = beforeStatus[0]?.status

        // Step 3: temporarily grant self-UPDATE -- created as the table
        // owner, before any role switch, so it has privilege to do so.
        await tx.unsafe(`
          CREATE POLICY temp_test_users_update_own ON public.users
            FOR UPDATE TO authenticated
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id)
        `)

        // Step 5-6: role escalation as the candidate. The temp policy above
        // WOULD permit this at the RLS layer (same row, WITH CHECK only
        // checks `id`) -- only the trigger can still stop it. Each attempt
        // runs inside its own SAVEPOINT: a Postgres error aborts the
        // enclosing transaction for every later statement until rolled
        // back, so without a savepoint one rejected UPDATE would poison
        // the is_admin() check and the final readback, not just itself.
        try {
          const r = await tx.savepoint(async (sp) => {
            await sp.unsafe(`SET LOCAL ROLE authenticated`)
            await sp.unsafe(`SET LOCAL request.jwt.claim.role = 'authenticated'`)
            await sp.unsafe(`SET LOCAL request.jwt.claim.sub = '${roleTestUid}'`)
            return await sp`UPDATE public.users SET role = 'admin' WHERE id = ${roleTestUid}`
          })
          roleAttemptRows = r.count
        } catch (e: any) {
          roleAttemptError = String(e?.message ?? e)
        }

        // Step 7-8: status escalation, attempted independently as the
        // never-activated candidate (pending -> active is a real change),
        // also in its own savepoint.
        try {
          const r = await tx.savepoint(async (sp) => {
            await sp.unsafe(`SET LOCAL ROLE authenticated`)
            await sp.unsafe(`SET LOCAL request.jwt.claim.role = 'authenticated'`)
            await sp.unsafe(`SET LOCAL request.jwt.claim.sub = '${statusTestUid}'`)
            return await sp`UPDATE public.users SET status = 'active' WHERE id = ${statusTestUid}`
          })
          statusAttemptRows = r.count
        } catch (e: any) {
          statusAttemptError = String(e?.message ?? e)
        }

        // Step 10: is_admin() must still read false for the role-escalation
        // attacker (still impersonated from the outer transaction's own
        // SET LOCAL, which the per-attempt SAVEPOINTs above do not affect
        // since each SET LOCAL ROLE was issued inside, and scoped to, its
        // own now-rolled-back-or-finished savepoint -- so re-assert the
        // role explicitly here before checking).
        await tx.unsafe(`SET LOCAL ROLE authenticated`)
        await tx.unsafe(`SET LOCAL request.jwt.claim.role = 'authenticated'`)
        await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${roleTestUid}'`)
        const adminCheck = await tx`SELECT is_admin() AS v`
        isAdminAfter = adminCheck[0]?.v

        // Step 9: re-read as the table owner (RESET ROLE -> not subject to
        // RLS), proving neither attempted write actually landed.
        await tx.unsafe(`RESET ROLE`)
        const afterRole = await tx`SELECT role FROM public.users WHERE id = ${roleTestUid}`
        postRole = afterRole[0]?.role
        const afterStatus = await tx`SELECT status FROM public.users WHERE id = ${statusTestUid}`
        postStatus = afterStatus[0]?.status

        // Step 11: unconditional rollback -- undoes the temporary policy and
        // the (expected-to-have-failed) UPDATE attempts in one step.
        throw { __rollback: true }
      })
    } catch (e: any) {
      if (!e?.__rollback) throw e
    }

    const roleBlocked = roleAttemptRows === 0 || !!roleAttemptError
    const statusBlocked = statusAttemptRows === 0 || !!statusAttemptError
    const roleUnchanged = postRole === preRole
    const statusUnchanged = postStatus === preStatus

    check("TEST 27a: freeze_moderation_columns() alone blocks role escalation even with a temporary RLS UPDATE policy granting it", "DENY",
      { allowed: !roleBlocked, rows: roleAttemptRows, error: roleAttemptError })
    check("TEST 27b: freeze_moderation_columns() alone blocks status escalation even with a temporary RLS UPDATE policy granting it", "DENY",
      { allowed: !statusBlocked, rows: statusAttemptRows, error: statusAttemptError })
    check("TEST 27c: role/status are provably unchanged after both isolated-trigger escalation attempts", "ALLOW",
      { allowed: roleUnchanged && statusUnchanged, rows: (roleUnchanged && statusUnchanged) ? 1 : 0 })
    check("TEST 27d: is_admin() remains false for the attacker after both isolated-trigger escalation attempts", "DENY",
      { allowed: Boolean(isAdminAfter), rows: isAdminAfter ? 1 : 0 })

    console.log(`  [TEST 27 detail] role: pre=${preRole} post=${postRole} (uid ${roleTestUid}) | status: pre=${preStatus} post=${postStatus} (uid ${statusTestUid})`)
    console.log(`  [TEST 27 detail] role-escalation attempt: ${roleAttemptError ? `REJECTED (${roleAttemptError})` : `rows=${roleAttemptRows}`}`)
    console.log(`  [TEST 27 detail] status-escalation attempt: ${statusAttemptError ? `REJECTED (${statusAttemptError})` : `rows=${statusAttemptRows}`}`)
    console.log(`  [TEST 27 detail] is_admin() after attempts: ${isAdminAfter}`)
  })()

  console.log(`\nRLS security tests: ${passed} passed, ${failed} failed\n`)
  await sql.end()
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})
