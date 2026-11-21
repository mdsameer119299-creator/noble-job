#!/usr/bin/env node
/**
 * run-script-chain.mjs — run EVERY `npm run <x>` step of an `a && b && c` package script, even after
 * one fails, then exit non-zero if ANY failed. `&&` stops at the first failure, which silently
 * skipped the remaining suites in CI (e.g. test:seo-phase1). Nothing is hidden or skipped: failing
 * suites are listed at the end and the exit code stays 1.
 *
 *   node scripts/run-script-chain.mjs <script-name> [--cwd <dir>]
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const cwdIdx = args.indexOf("--cwd")
const cwd = cwdIdx >= 0 ? path.resolve(args.splice(cwdIdx, 2)[1]) : process.cwd()
const name = args[0]
if (!name) { console.error("usage: run-script-chain.mjs <script-name> [--cwd <dir>]"); process.exit(2) }

const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"))
const body = pkg.scripts?.[name]
if (!body) { console.error(`script "${name}" not found`); process.exit(2) }

const steps = body.split("&&").map(s => s.trim()).filter(Boolean)
const scripts = steps.map(s => {
  const m = /^npm run (?:-s |--silent )?([\w:.-]+)$/.exec(s)
  if (!m) { console.error(`"${name}" is not a pure chain of "npm run <script>" (offending part: ${s})`); process.exit(2) }
  return m[1]
})

const results = []
for (const s of scripts) {
  console.log(`\n::group::npm run ${s}`)
  const r = spawnSync("npm", ["run", s], { cwd, stdio: "inherit", shell: process.platform === "win32" })
  console.log("::endgroup::")
  results.push({ script: s, ok: r.status === 0, status: r.status })
}

const failed = results.filter(r => !r.ok)
console.log(`\n=== ${name}: ${results.length - failed.length}/${results.length} suites passed ===`)
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.script}`)
if (failed.length) {
  console.error(`\n${failed.length} suite(s) FAILED: ${failed.map(f => f.script).join(", ")}`)
  process.exit(1)
}
