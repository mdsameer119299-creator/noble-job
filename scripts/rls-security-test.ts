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

  console.log(`\nRLS security tests: ${passed} passed, ${failed} failed\n`)
  await sql.end()
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})
