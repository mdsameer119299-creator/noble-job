/**
 * resumeWorkspace.test.ts — Resume AI workspace shell (PR-Resume-02): mode
 * configuration, job-description validation, analytics allowlisting, and route
 * noindex/wiring. Pure + fs assertions (no framework).
 *   npm run test:resume-workspace
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  RESUME_WORKSPACE_MODES,
  RESUME_WORKSPACE_MODE_KEYS,
  RESUME_BUILD_SECTIONS,
  JOB_DESCRIPTION_MAX_CHARS,
  getResumeWorkspaceMode,
  validateJobDescription,
} from "./resumeWorkspace"
import { AcqEvent } from "../analytics/events"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

// ── Mode configuration ────────────────────────────────────────────────────
test("three workspace modes: improve, build, tailor", () => {
  assert.deepEqual([...RESUME_WORKSPACE_MODE_KEYS].sort(), ["build", "improve", "tailor"])
  assert.equal(Object.keys(RESUME_WORKSPACE_MODES).length, 3)
})

test("each mode maps to its /resume/<key> route and entryFlow === key", () => {
  for (const key of RESUME_WORKSPACE_MODE_KEYS) {
    const m = RESUME_WORKSPACE_MODES[key]
    assert.equal(m.path, `/resume/${key}`)
    assert.equal(m.entryFlow, key)
  }
})

test("getResumeWorkspaceMode resolves known keys and returns undefined otherwise", () => {
  assert.equal(getResumeWorkspaceMode("improve")?.title, "Improve My Resume")
  assert.equal(getResumeWorkspaceMode("nope"), undefined)
  assert.equal(getResumeWorkspaceMode(""), undefined)
})

test("every mode has non-empty title, tagline, explanation, steps, truthfulness, futureNote", () => {
  for (const key of RESUME_WORKSPACE_MODE_KEYS) {
    const m = RESUME_WORKSPACE_MODES[key]
    for (const field of ["title", "tagline", "explanation", "truthfulness", "futureNote"] as const) {
      assert.ok(m[field].trim().length > 0, `${key}.${field}`)
    }
    assert.ok(m.steps.length >= 3, `${key}.steps`)
    assert.equal(m.eyebrow, "Noble Resume AI")
  }
})

test("Build planned sections are the seven expected sections", () => {
  assert.deepEqual([...RESUME_BUILD_SECTIONS], [
    "Personal Details", "Experience", "Education", "Skills", "Projects", "Achievements", "Certifications",
  ])
})

// ── Job-description validation ────────────────────────────────────────────
test("JOB_DESCRIPTION_MAX_CHARS is a sane positive cap", () => {
  assert.ok(JOB_DESCRIPTION_MAX_CHARS > 1000 && JOB_DESCRIPTION_MAX_CHARS <= 100000)
})

test("validateJobDescription rejects empty/whitespace", () => {
  assert.deepEqual(validateJobDescription(""), { ok: false, reason: "empty", length: 0 })
  assert.deepEqual(validateJobDescription("   \n\t "), { ok: false, reason: "empty", length: 0 })
})

test("validateJobDescription accepts normal text (trimmed length)", () => {
  const v = validateJobDescription("  Senior Engineer, React, 5y  ")
  assert.equal(v.ok, true)
  if (v.ok) assert.equal(v.length, "Senior Engineer, React, 5y".length)
})

test("validateJobDescription rejects oversized input at the boundary", () => {
  const ok = validateJobDescription("x".repeat(JOB_DESCRIPTION_MAX_CHARS))
  assert.equal(ok.ok, true)
  const bad = validateJobDescription("x".repeat(JOB_DESCRIPTION_MAX_CHARS + 1))
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.equal(bad.reason, "too_long")
})

// ── Analytics allowlisting ────────────────────────────────────────────────
test("new funnel events exist on AcqEvent", () => {
  assert.equal(AcqEvent.RESUME_WORKSPACE_VIEWED, "resume_workspace_viewed")
  assert.equal(AcqEvent.RESUME_FILE_SELECTED, "resume_file_selected")
  assert.equal(AcqEvent.RESUME_BUILD_METHOD_SELECTED, "resume_build_method_selected")
  assert.equal(AcqEvent.RESUME_TAILOR_TARGET_ENTERED, "resume_tailor_target_entered")
  assert.equal(AcqEvent.RESUME_SIGNIN_REQUESTED, "resume_signin_requested")
})

test("every new event is ALLOWED by /api/events (else silently dropped)", () => {
  const src = read("src/app/api/events/route.ts")
  for (const ev of [
    "resume_workspace_viewed", "resume_file_selected", "resume_build_method_selected",
    "resume_tailor_target_entered", "resume_signin_requested",
  ]) {
    assert.ok(new RegExp(`["']${ev}["']`).test(src), `"${ev}" must be in the /api/events allowlist`)
  }
})

// ── Routes: noindex + wired to the shared shell ───────────────────────────
test("all three /resume routes are noindex and render the shared shell", () => {
  for (const key of RESUME_WORKSPACE_MODE_KEYS) {
    const src = read(join("src", "app", "resume", key, "page.tsx"))
    assert.match(src, /noIndex:\s*true/, `${key} must be noIndex`)
    assert.match(src, /ResumeWorkspaceShell/, `${key} must render ResumeWorkspaceShell`)
    assert.match(src, new RegExp(`mode="${key}"`), `${key} must pass mode="${key}"`)
  }
})

console.log(`\nresume-workspace tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
