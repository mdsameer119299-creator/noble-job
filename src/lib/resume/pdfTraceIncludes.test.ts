/**
 * Regression guard for the Vercel-only "every valid PDF is unreadable" failure.
 *
 * pdf.js (pdf-parse 1.10) `require()`s modules at RUNTIME (`node-ensure`, `./pdf.worker.js`). The worker
 * locates pdf.js by path, so file tracing can't see those requires; Vercel packages each function from its
 * own trace only. This test reads the real pdf.js sources and fails if any non-builtin module they require
 * is not covered by outputFileTracingIncludes for BOTH routes that parse PDFs.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { builtinModules } from "node:module"
import nextConfig from "../../../next.config"

const ROUTES = ["/api/resume/quick-score", "/api/candidate/resume-score"]
const root = path.resolve(__dirname, "../../..")
const buildDir = path.join(root, "node_modules/pdf-parse/lib/pdf.js/v1.10.100/build")

const includes = (nextConfig.outputFileTracingIncludes ?? {}) as Record<string, string[]>

function covered(rel: string, globs: string[]): boolean {
  return globs.some(g => {
    const base = g.replace(/^\.\//, "")
    return base.endsWith("/**/*") ? rel.startsWith(base.slice(0, -4)) : rel === base
  })
}

for (const route of ROUTES) {
  const globs = includes[route] ?? []
  const builtin = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])
  for (const file of ["pdf.js", "pdf.worker.js"]) {
    const src = fs.readFileSync(path.join(buildDir, file), "utf8")
    assert.ok(covered(`node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/${file}`, globs), `${route}: ${file} is included`)
    for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1]
      if (builtin.has(spec)) continue
      if (spec.startsWith(".")) {
        const rel = path.posix.join("node_modules/pdf-parse/lib/pdf.js/v1.10.100/build", spec)
        assert.ok(covered(rel, globs), `relative require "${spec}" in ${file} must be included for ${route}`)
      } else {
        const pkg = spec.split("/")[0]
        assert.ok(
          covered(`node_modules/${pkg}/index.js`, globs) && covered(`node_modules/${pkg}/package.json`, globs),
          `runtime dependency "${pkg}" required by ${file} must be in outputFileTracingIncludes for ${route}`,
        )
        // and its own requires must be builtins/already covered (node-ensure has none)
        const pj = path.join(root, "node_modules", pkg)
        for (const f of fs.readdirSync(pj).filter(x => x.endsWith(".js"))) {
          for (const n of fs.readFileSync(path.join(pj, f), "utf8").matchAll(/require\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g)) {
            assert.ok(builtin.has(n[1]) || covered(`node_modules/${n[1].split("/")[0]}/index.js`, globs), `${pkg} requires "${n[1]}" which is not included for ${route}`)
          }
        }
      }
    }
  }
}
console.log("pdf trace includes: OK")
