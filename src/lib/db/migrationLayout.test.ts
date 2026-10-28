/**
 * migrationLayout.test.ts — `supabase/migrations` must be a layout the Supabase CLI applies correctly.
 *
 *   npm run test:migration-layout
 *
 * WHY. The CLI treats EVERY `<digits>_<anything>.sql` file in supabase/migrations as a migration and takes the digits as its
 * version. A rollback companion named `20261026000001_x.down.sql` therefore matches too — as version 20261026000001, name
 * "x.down" — and shares its version with the forward file `20261026000001_x.sql`. Reproduced with the real CLI (v2.122.0,
 * `supabase db push --db-url <disposable local database>`):
 *
 *     Applying migration 20260610000001_govt_jobs_reconcile.down.sql...      <- the ROLLBACK runs first (it sorts first)
 *     Applying migration 20260610000001_govt_jobs_reconcile.sql...
 *     ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
 *            Key (version)=(20260610000001) already exists.
 *
 * i.e. a fresh `db push` / `db reset` runs the rollbacks and then fails. Rollback scripts therefore live in
 * `supabase/rollbacks/`, which the CLI never reads, and nothing but forward migrations may be in `supabase/migrations/`.
 *
 * THE MATCHER below is the CLI's own: the Go regexp `^([0-9]+)_(.*)\.sql$`, read out of the v2.122.0 release binary
 * (`strings supabase | grep '_(.\*)'`). A file that does NOT match is silently skipped by the CLI (a "migration" that never
 * runs), so this suite rejects those as well as duplicate versions.
 */
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

/** The Supabase CLI's migration filename matcher (v2.122.0): group 1 = version, group 2 = name. */
export const CLI_MIGRATION_FILE = /^([0-9]+)_(.*)\.sql$/

export interface LayoutProblem { file: string; problem: string }

/**
 * Judge a directory listing the way the CLI would read it. Returns every problem found ([] = a layout the CLI applies
 * exactly once per file): entries the CLI would skip, rollback companions, and duplicate versions.
 */
export function checkMigrationLayout(entries: { name: string; isDirectory: boolean }[]): LayoutProblem[] {
  const problems: LayoutProblem[] = []
  const byVersion = new Map<string, string[]>()
  for (const e of entries) {
    if (e.isDirectory) { problems.push({ file: e.name, problem: "directory: nothing but forward migration files may live here" }); continue }
    const m = CLI_MIGRATION_FILE.exec(e.name)
    if (!m) { problems.push({ file: e.name, problem: "does not match the CLI pattern ^([0-9]+)_(.*)\\.sql$, so the CLI would silently SKIP it" }); continue }
    if (/\.down$/i.test(m[2]) || /\.(down|rollback|undo)\.sql$/i.test(e.name)) {
      problems.push({ file: e.name, problem: "rollback companion: the CLI would apply it as a migration (before the forward file) — keep it in supabase/rollbacks/" })
    }
    byVersion.set(m[1], [...(byVersion.get(m[1]) ?? []), e.name])
  }
  for (const [version, files] of byVersion) {
    if (files.length > 1) problems.push({ file: files.join(" + "), problem: `duplicate migration version ${version}: schema_migrations.version is the primary key` })
  }
  return problems
}

const list = (dir: string) => readdirSync(dir).sort().map(name => ({ name, isDirectory: statSync(join(dir, name)).isDirectory() }))
const MIGRATIONS = join(process.cwd(), "supabase", "migrations")
const ROLLBACKS = join(process.cwd(), "supabase", "rollbacks")

/* ------------------------------ the real directory ------------------------------ */

test("every entry in supabase/migrations is read by the CLI matcher, and no version appears twice", () => {
  const entries = list(MIGRATIONS)
  assert.ok(entries.length > 30, "premise: found the migrations")
  assert.deepEqual(checkMigrationLayout(entries), [])
})

test("no `.down.sql` (or other rollback companion) is inside supabase/migrations", () => {
  assert.deepEqual(list(MIGRATIONS).filter(e => /\.(down|rollback|undo)\.sql$/i.test(e.name)).map(e => e.name), [])
})

test("migration versions are unique and applied in strictly increasing order", () => {
  const versions = list(MIGRATIONS).map(e => CLI_MIGRATION_FILE.exec(e.name)![1])
  assert.equal(new Set(versions).size, versions.length)
  assert.deepEqual([...versions].sort(), versions, "directory order == version order")
  for (let i = 1; i < versions.length; i++) assert.ok(BigInt(versions[i]) > BigInt(versions[i - 1]), `${versions[i - 1]} < ${versions[i]}`)
})

test("every rollback in supabase/rollbacks is `<version>_<name>.down.sql` for a forward migration that exists, and is never read by the CLI", () => {
  const forward = new Map(list(MIGRATIONS).map(e => { const m = CLI_MIGRATION_FILE.exec(e.name)!; return [m[1], m[2]] as const }))
  const rollbacks = list(ROLLBACKS).filter(e => e.name !== "README.md")
  assert.ok(rollbacks.length > 0, "premise: rollbacks were kept, not deleted")
  for (const r of rollbacks) {
    const m = /^([0-9]+)_(.+)\.down\.sql$/.exec(r.name)
    assert.ok(m, `${r.name} must be named <version>_<name>.down.sql`)
    assert.equal(forward.get(m![1]), m![2], `${r.name}: no forward migration with this version and name`)
    assert.ok(statSync(join(ROLLBACKS, r.name)).size > 0, `${r.name} is not empty`)
  }
  assert.equal(new Set(rollbacks.map(r => r.name)).size, rollbacks.length)
})

test("the layout rule is documented where people will look (supabase/rollbacks/README.md)", () => {
  const readme = readFileSync(join(ROLLBACKS, "README.md"), "utf8")
  assert.match(readme, /Supabase CLI/); assert.match(readme, /supabase\/migrations/); assert.match(readme, /duplicate/i)
})

/* ------------------------- alignment with the live migration history ------------------------- */
/*
 * The live `supabase_migrations.schema_migrations` table was audited read-only on 2026-10-28 (33 rows). Its version/name
 * inventory is pinned in supabase/rehearsal/live-history-inventory.json (versions and names only). The Supabase CLI compares
 * VERSIONS: a version present remotely but missing locally, or a local version older than the newest remote one that the
 * remote lacks, blocks `db push`. These tests pin that the local list lines up with the live history, so the only pending
 * migration is the intended one. See docs/MIGRATION_HISTORY.md.
 */
import { createHash } from "node:crypto"
const REHEARSAL = join(process.cwd(), "supabase", "rehearsal")
const PENDING_INTENDED = ["20261026000001"]
const liveInventory = (JSON.parse(readFileSync(join(REHEARSAL, "live-history-inventory.json"), "utf8")) as { rows: { version: string; name: string }[] }).rows
const localForward = list(MIGRATIONS).map(e => { const m = CLI_MIGRATION_FILE.exec(e.name)!; return { version: m[1], name: m[2] } })

test("live inventory fixture is well-formed: 33 unique versions, names only (no statements, no connection details)", () => {
  assert.equal(liveInventory.length, 33)
  assert.equal(new Set(liveInventory.map(r => r.version)).size, 33)
  assert.deepEqual(liveInventory.map(r => r.version), [...liveInventory.map(r => r.version)].sort())
  const raw = readFileSync(join(REHEARSAL, "live-history-inventory.json"), "utf8")
  assert.doesNotMatch(raw, /postgres(ql)?:\/\/|password|secret|token|supabase\.co|statements"/i)
})

test("every live version has a local forward file, and the only local version the live history lacks is the intended pending migration", () => {
  const live = new Set(liveInventory.map(r => r.version)), local = new Set(localForward.map(r => r.version))
  assert.deepEqual([...live].filter(v => !local.has(v)), [], "live-only versions: the CLI would refuse to push")
  assert.deepEqual([...local].filter(v => !live.has(v)), PENDING_INTENDED, "local-only versions == exactly the intended pending migration")
})

test("the intended pending migration is newer than every live version (so it is not out-of-order)", () => {
  const newestLive = liveInventory.map(r => BigInt(r.version)).reduce((a, b) => (a > b ? a : b))
  for (const v of PENDING_INTENDED) assert.ok(BigInt(v) > newestLive, `${v} > ${newestLive}`)
})

test("20261025: the repository carries the LIVE version 20261025102650; the old draft version 20261025000001 is gone", () => {
  const f = "20261025102650_refix_storage_resume_employer_applicant"
  assert.ok(list(MIGRATIONS).some(e => e.name === `${f}.sql`))
  assert.ok(list(ROLLBACKS).some(e => e.name === `${f}.down.sql`))
  for (const dir of [MIGRATIONS, ROLLBACKS]) assert.ok(!list(dir).some(e => e.name.startsWith("20261025000001")), `no 20261025000001 left in ${dir}`)
  assert.deepEqual(liveInventory.find(r => r.version === "20261025102650"), { version: "20261025102650", name: "refix_storage_resume_employer_applicant" })
})

test("20261025102650: the applied SQL is pinned (executable SQL equals what the live history recorded)", () => {
  const text = readFileSync(join(MIGRATIONS, "20261025102650_refix_storage_resume_employer_applicant.sql"), "utf8").replace(/\r\n/g, "\n")
  // Byte-exact body: from the first CREATE OR REPLACE FUNCTION to the end of the file. The header above it may be reworded; this may not.
  const start = text.search(/^CREATE OR REPLACE FUNCTION/m) // line-anchored: the header comment also mentions the phrase
  assert.ok(start > 0)
  const body = text.slice(start)
  assert.equal(createHash("sha256").update(body).digest("hex"), "a35254db2c058fe196e07fee33c09bbf27b22938c4ef4b3c9ab8e60263054af4")
  // Executable SQL with comments, whitespace and ';' removed, hashed the same way the live row was (md5, 583 chars).
  const exec = text.replace(/--[^\n]*/g, "").replace(/[\s;]/g, "")
  assert.equal(exec.length, 583)
  assert.equal(createHash("md5").update(exec).digest("hex"), "3e1719a145c35a948f9f988d7525292c")
  assert.match(body, /e\.verified = true/); assert.match(body, /admin_review_status IN \('approved','shared'\)/)
})

test("history names: only the 9 audited rollback-recorded versions differ from the local name, and only by a `.down` suffix", () => {
  const local = new Map(localForward.map(r => [r.version, r.name]))
  const differing = liveInventory.filter(r => local.get(r.version) !== r.name)
  assert.deepEqual(differing.map(r => r.version), [
    "20260610000001", "20260616000001", "20260616000002", "20260616000003", "20260706000001",
    "20260930000001", "20260930000002", "20260930000003", "20261001000001",
  ])
  for (const r of differing) assert.equal(r.name, `${local.get(r.version)}.down`, r.version)
})

test("docs/MIGRATION_HISTORY.md records the alignment and the separately-tracked synthetic_jobs_visible issue", () => {
  const doc = readFileSync(join(process.cwd(), "docs", "MIGRATION_HISTORY.md"), "utf8")
  for (const needle of ["20261025102650", "20261025000001", "synthetic_jobs_visible", "20260929000003", "migration repair"]) assert.ok(doc.includes(needle), needle)
  assert.doesNotMatch(doc, /postgres(ql)?:\/\/|eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role key/i)
})

/* ------------------------------ the checker itself ------------------------------ */

const F = (name: string, isDirectory = false) => ({ name, isDirectory })

test("checker: the CLI pattern reads `X.down.sql` as version X, name `…down` — the reason it must not be here", () => {
  const m = CLI_MIGRATION_FILE.exec("20260727000001_govt_jobs_record_integrity.down.sql")
  assert.deepEqual([m![1], m![2]], ["20260727000001", "govt_jobs_record_integrity.down"])
})

test("checker: a clean listing passes", () => {
  assert.deepEqual(checkMigrationLayout([F("20250603000001_initial_schema.sql"), F("20260611000001_ingest_runs.sql")]), [])
})

test("checker: a rollback companion beside its forward file is rejected twice over (rollback + duplicate version)", () => {
  const p = checkMigrationLayout([F("20260727000001_x.sql"), F("20260727000001_x.down.sql")])
  assert.equal(p.length, 2)
  assert.ok(p.some(x => /rollback companion/.test(x.problem)))
  assert.ok(p.some(x => /duplicate migration version 20260727000001/.test(x.problem)))
})

test("checker: a duplicate version with different names is rejected", () => {
  const p = checkMigrationLayout([F("20260101000001_a.sql"), F("20260101000001_b.sql")])
  assert.equal(p.length, 1)
  assert.match(p[0].problem, /duplicate migration version 20260101000001/)
})

test("checker: files the CLI would silently skip are rejected (wrong shape, wrong extension, README, uppercase, no underscore)", () => {
  for (const name of ["README.md", "notes.txt", "20260101000001.sql", "20260101000001_x.SQL", "x_20260101000001.sql", "_x.sql", "20260101000001_x.sql.bak", ".gitkeep", "20260101000001-x.sql"]) {
    const p = checkMigrationLayout([F(name)])
    assert.equal(p.length, 1, name)
    assert.match(p[0].problem, /silently SKIP/, name)
  }
})

test("checker: rollback-style names are rejected even when they would otherwise be unique", () => {
  for (const name of ["20260101000001_x.down.sql", "20260101000001_x.rollback.sql", "20260101000001_x.undo.sql", "20260101000002_y.down.sql"]) {
    assert.ok(checkMigrationLayout([F(name)]).some(p => /rollback companion/.test(p.problem)), name)
  }
})

test("checker: subdirectories are rejected", () => {
  assert.equal(checkMigrationLayout([F("archive", true)]).length, 1)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
