/**
 * resumeModes.test.ts — Resume AI launcher: destination mapping + analytics
 * allowlisting + placeholder-route SEO safety. Pure/fs assertions (no framework).
 *   npm run test:resume
 */
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import {
  RESUME_MODES,
  RESUME_MODE_EVENT,
  RESUME_PLACEHOLDER_MODES,
  resumeModeHref,
} from "./resumeModes"
import { AcqEvent } from "../analytics/events"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

// ── CTA set + destination mapping ─────────────────────────────────────────
test("exactly four CTAs with unique keys incl. improve/build/tailor/report", () => {
  const keys = RESUME_MODES.map(m => m.key)
  assert.equal(RESUME_MODES.length, 4)
  assert.deepEqual([...keys].sort(), ["build", "improve", "report", "tailor"])
  assert.equal(new Set(keys).size, 4)
})

test("navigating modes map to their /resume/* placeholder route", () => {
  assert.equal(resumeModeHref("improve"), "/resume/improve")
  assert.equal(resumeModeHref("build"), "/resume/build")
  assert.equal(resumeModeHref("tailor"), "/resume/tailor")
})

test("'report' is in-place (href null) so it preserves report state — never navigates", () => {
  assert.equal(resumeModeHref("report"), null)
  const report = RESUME_MODES.find(m => m.key === "report")
  assert.ok(report && report.href === null)
})

test("unknown mode key → undefined (no accidental destination)", () => {
  assert.equal(resumeModeHref("delete-everything"), undefined)
  assert.equal(resumeModeHref(""), undefined)
})

test("every CTA has a non-empty label and description (no dead labels)", () => {
  for (const m of RESUME_MODES) {
    assert.ok(m.label.trim().length > 0, `label for ${m.key}`)
    assert.ok(m.desc.trim().length > 0, `desc for ${m.key}`)
  }
})

// ── Analytics allowlisting ────────────────────────────────────────────────
test("RESUME_MODE_EVENT matches AcqEvent.RESUME_MODE_SELECTED", () => {
  assert.equal(RESUME_MODE_EVENT, "resume_mode_selected")
  assert.equal(AcqEvent.RESUME_MODE_SELECTED, RESUME_MODE_EVENT)
})

test("the mode event is ALLOWED by /api/events (else it is silently dropped)", () => {
  const src = read("src/app/api/events/route.ts")
  assert.match(src, /const ALLOWED = new Set\(\[[\s\S]*?\]\)/)
  assert.ok(
    new RegExp(`["']${RESUME_MODE_EVENT}["']`).test(src),
    `"${RESUME_MODE_EVENT}" must appear in the /api/events allowlist`,
  )
})

// ── Placeholder routes exist and are SEO-safe ─────────────────────────────
test("each navigating mode has a real page file at src/app/resume/<mode>/page.tsx", () => {
  for (const mode of RESUME_PLACEHOLDER_MODES) {
    const p = join("src", "app", "resume", mode, "page.tsx")
    assert.ok(existsSync(join(root, p)), `missing page: ${p}`)
  }
})

test("placeholder pages are noindex — no thin-content SEO regression", () => {
  for (const mode of RESUME_PLACEHOLDER_MODES) {
    const src = read(join("src", "app", "resume", mode, "page.tsx"))
    assert.match(src, /noIndex:\s*true/, `${mode} page must set noIndex: true`)
  }
})

test("placeholder destinations are internal, root-relative, non-dead paths", () => {
  for (const mode of RESUME_PLACEHOLDER_MODES) {
    const href = resumeModeHref(mode)
    assert.ok(typeof href === "string" && href.startsWith("/") && !href.startsWith("//"))
  }
})

console.log(`\nresume-launcher tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
