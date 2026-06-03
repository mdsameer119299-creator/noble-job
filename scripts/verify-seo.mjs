#!/usr/bin/env node
/**
 * Static SEO verification for Noble Job (no Lighthouse).
 * Run after: npm run build
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const src = path.join(root, "src")

const checks = []
function pass(id, msg) {
  checks.push({ id, status: "PASS", msg })
}
function fail(id, msg) {
  checks.push({ id, status: "FAIL", msg })
}
function warn(id, msg) {
  checks.push({ id, status: "WARN", msg })
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

// Core files
for (const f of [
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/opengraph-image.tsx",
  "src/lib/seo/metadata.ts",
  "src/lib/seo/schema.ts",
  "src/components/seo/SiteSchemas.tsx",
]) {
  exists(f) ? pass(`file:${f}`, "present") : fail(`file:${f}`, "missing")
}

// Metadata on public job detail routes
for (const page of [
  "src/app/jobs/private/[id]/page.tsx",
  "src/app/jobs/wfh/[id]/page.tsx",
  "src/app/jobs/abroad/[id]/page.tsx",
  "src/app/jobs/govt/[id]/page.tsx",
]) {
  const c = read(page)
  if (c.includes("generateMetadata") && c.includes("buildPageMetadata")) {
    pass(`meta:${page}`, "dynamic metadata")
  } else if (c.includes("generateMetadata")) {
    warn(`meta:${page}`, "generateMetadata without buildPageMetadata")
  } else {
    fail(`meta:${page}`, "no generateMetadata")
  }
}

// JobPosting JSON-LD
for (const [page, comp] of [
  ["src/app/jobs/private/[id]/page.tsx", "PrivateJobJsonLd"],
  ["src/app/jobs/wfh/[id]/page.tsx", "WfhJobJsonLd"],
  ["src/app/jobs/abroad/[id]/page.tsx", "AbroadJobJsonLd"],
  ["src/app/jobs/govt/[id]/page.tsx", "GovtJobJsonLd"],
]) {
  read(page).includes(comp) ? pass(`schema:${comp}`, page) : fail(`schema:${comp}`, `missing in ${page}`)
}

// Breadcrumbs on detail pages
for (const page of [
  "src/app/jobs/private/[id]/page.tsx",
  "src/app/jobs/wfh/[id]/page.tsx",
  "src/app/jobs/abroad/[id]/page.tsx",
]) {
  read(page).includes("Breadcrumbs")
    ? pass(`crumb:${page}`, "breadcrumb UI + schema")
    : warn(`crumb:${page}`, "no Breadcrumbs component")
}

// Noindex dashboards
for (const layout of ["src/app/candidate/layout.tsx", "src/app/employer/layout.tsx", "src/app/admin/layout.tsx"]) {
  const c = read(layout)
  if (c.includes("index: false") || c.includes("index:false")) pass(`noindex:${layout}`, "robots noindex")
  else fail(`noindex:${layout}`, "missing noindex")
}

// Sitemap should not list auth
const sitemap = read("src/app/sitemap.ts")
sitemap.includes("/auth") ? warn("sitemap:auth", "/auth still in sitemap") : pass("sitemap:auth", "auth excluded")

// buildPageMetadata OG + Twitter
const metaLib = read("src/lib/seo/metadata.ts")
metaLib.includes("twitter") && metaLib.includes("openGraph") && metaLib.includes("canonical")
  ? pass("meta:og-twitter", "OG + Twitter in helper")
  : fail("meta:og-twitter", "incomplete metadata helper")

// Viewport / skip link
exists("src/app/viewport.ts") ? pass("viewport", "mobile viewport export") : fail("viewport", "missing viewport.ts")
read("src/app/layout.tsx").includes("skip-to-main") ? pass("a11y:skip", "skip link") : fail("a11y:skip", "no skip link")

const passN = checks.filter(c => c.status === "PASS").length
const failN = checks.filter(c => c.status === "FAIL").length
const warnN = checks.filter(c => c.status === "WARN").length

console.log("\n=== Noble Job SEO Verification ===\n")
for (const c of checks) {
  const icon = c.status === "PASS" ? "✓" : c.status === "WARN" ? "!" : "✗"
  console.log(`${icon} [${c.status}] ${c.id}: ${c.msg}`)
}
console.log(`\nResult: ${passN} PASS, ${warnN} WARN, ${failN} FAIL\n`)
process.exit(failN > 0 ? 1 : 0)
