/**
 * adminRoute.test.ts — source-level regression guards for the admin API and its
 * services. The route is Next/Supabase-coupled (can't run in a plain node
 * harness), so we assert the integrity guarantees by inspecting the source —
 * the same approach used by govtCache.test.ts.
 *   npm run test:admin-route
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

const ROUTE = "src/app/api/admin/[[...params]]/route.ts"
const ADMIN_SVC = "src/lib/services/adminService.ts"
const CONTENT_SVC = "src/lib/services/siteContentService.ts"

// ── Unknown routes → 404, never {success:true} ───────────────────────────
test("route no longer returns a bare {success:true} fallthrough", () => {
  const src = read(ROUTE)
  // The old bug: PUT/PATCH/DELETE ended with `return NextResponse.json({ success: true })`.
  assert.doesNotMatch(src, /return NextResponse\.json\(\{\s*success:\s*true\s*\}\)\s*\n\}/)
  // Every verb handler must be able to end in notFound().
  const notFoundCount = (src.match(/return notFound\(\)/g) || []).length
  assert.ok(notFoundCount >= 4, `expected ≥4 notFound() fallthroughs, found ${notFoundCount}`)
})

// ── DB errors are surfaced, not hidden as empty arrays ───────────────────
test("list GETs check `error` and use dbError() (no hidden empty arrays)", () => {
  const src = read(ROUTE)
  assert.match(src, /function dbError\(/)
  // Each list route destructures `error` and returns dbError on failure.
  const dbErrorUses = (src.match(/return dbError\(/g) || []).length
  assert.ok(dbErrorUses >= 8, `expected ≥8 dbError() guards, found ${dbErrorUses}`)
})

// ── Pagination + bounded counts ──────────────────────────────────────────
test("route imports pagination + bounded-count helpers and uses them", () => {
  const src = read(ROUTE)
  assert.match(src, /parsePagination/)
  assert.match(src, /parseJobIds/)
  // application-counts must not do an unbounded full-table select without a cap/scope.
  assert.match(src, /application-counts/)
  assert.match(src, /\.in\("job_id", jobIds\)/)
  assert.match(src, /ADMIN_LIST_MAX_LIMIT/)
})

// ── Mutation body validation ─────────────────────────────────────────────
test("settings/content PUT validates the body and checks write errors", () => {
  const src = read(ROUTE)
  assert.match(src, /validateKeyValueBody\(body\)/)
  assert.match(src, /if \(!v\.ok\) return NextResponse\.json\(\{ error: v\.error \}/)
  // Must return the DB error from the write, never blind success.
  assert.match(src, /if \(res\.error\) return dbError\(res\.error\.message\)/)
})

test("path ids are UUID-validated before mutations", () => {
  const src = read(ROUTE)
  assert.match(src, /isUuid/)
})

// ── Approvals: notify only after a successful DB mutation ────────────────
test("approveJob/rejectJob return early on DB error (no notify after failure)", () => {
  const src = read(ADMIN_SVC)
  // Both functions must guard on result.error before notifying.
  const approve = src.slice(src.indexOf("export async function approveJob"), src.indexOf("export async function rejectJob"))
  const reject = src.slice(src.indexOf("export async function rejectJob"), src.indexOf("export async function verifyEmployer"))
  assert.match(approve, /if \(result\.error\) return result/)
  assert.match(reject, /if \(result\.error\) return result/)
  // reject keeps dashboard counts consistent by archiving job_status.
  assert.match(reject, /job_status:\s*"ARCHIVED_JOB"/)
})

// ── Settings/content writes use UPSERT + service role + return errors ─────
test("siteContentService writes upsert via supabaseAdmin and return errors", () => {
  const src = read(CONTENT_SVC)
  assert.match(src, /from\("site_content"\)\s*\n?\s*\.upsert\(/)
  assert.match(src, /from\("admin_settings"\)\s*\n?\s*\.upsert\(/)
  assert.match(src, /supabaseAdmin/)
  // No silent UPDATE-by-key that matches zero rows.
  assert.doesNotMatch(src, /from\("admin_settings"\)\.update\(/)
})

// ── Placeholder UIs were replaced with functional components ─────────────
test("Settings/Content/Messages UIs are no longer permanent placeholders", () => {
  for (const [file, api] of [
    ["src/components/admin/SettingsForm.tsx", "/api/admin/settings"],
    ["src/components/admin/ContentEditor.tsx", "/api/admin/content"],
    ["src/components/admin/MessageViewModal.tsx", "/api/admin/messages"],
  ] as const) {
    const src = read(file)
    assert.doesNotMatch(src, /Loading (settings|edit content|message)…\s*<\/p>\s*<\/div>\s*\)\s*\n\}/)
    assert.ok(src.includes(api), `${file} must call ${api}`)
    assert.match(src, /useEffect/) // has real load lifecycle
  }
})

console.log(`\nadmin-route regression tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
