/**
 * validate-sitemap.ts — structural validation of a generated sitemap.xml.
 *
 *   npx tsx scripts/validate-sitemap.ts <url-or-file> [--base https://www.noblejob.in]
 *   e.g. npx tsx scripts/validate-sitemap.ts http://localhost:3000/sitemap.xml --base http://localhost:3000
 *
 * Checks (src/lib/seo/sitemapPolicy.ts → validateSitemapEntries): absolute same-origin
 * URLs, no query/fragment URLs, no auth/api/dashboard paths, no redirect sources,
 * no duplicates, no future lastmod, and that lastmod is NOT the generation time /
 * one identical value on every URL. Exit 1 on any error.
 */
import fs from "node:fs"
import { validateSitemapEntries, type SitemapEntry } from "../src/lib/seo/sitemapPolicy"

const REDIRECT_SOURCES = new Set(["/jobs", "/jobs/govt/rrb-ntpc-graduate-level-recruitment-2026"])

async function main() {
  const args = process.argv.slice(2)
  const src = args.find(a => !a.startsWith("--")) ?? "http://localhost:3000/sitemap.xml"
  const bi = args.indexOf("--base")
  const xml = /^https?:\/\//.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, "utf8")
  const base = bi >= 0 ? args[bi + 1] : new URL(/^https?:\/\//.test(src) ? src : "https://www.noblejob.in").origin

  const entries: SitemapEntry[] = []
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim().replace(/&amp;/g, "&")
    const lm = m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim()
    if (!loc) continue
    entries.push({ url: loc, lastModified: lm ? new Date(lm) : undefined })
  }
  if (!entries.length) { console.error("❌ no <url> entries found — is this a sitemap?"); process.exit(1) }

  const { errors, warnings } = validateSitemapEntries(entries, { base, redirectSources: REDIRECT_SOURCES })
  const dated = entries.filter(e => e.lastModified).length
  console.log(`URLs: ${entries.length} · with lastmod: ${dated} · distinct lastmod values: ${new Set(entries.filter(e => e.lastModified).map(e => e.lastModified!.toISOString())).size}`)
  const byKind: Record<string, number> = {}
  for (const e of entries) {
    const p = new URL(e.url).pathname
    const k = /^\/jobs\/(private|wfh|abroad)\/./.test(p) ? `jobs/${p.split("/")[2]}` : p.startsWith("/jobs/govt/") ? "govt" : p.startsWith("/guides") ? "guides" : "other"
    byKind[k] = (byKind[k] ?? 0) + 1
  }
  console.log("By section:", JSON.stringify(byKind))
  for (const w of warnings) console.warn(`⚠ ${w}`)
  for (const e of errors) console.error(`✗ ${e}`)
  console.log(errors.length ? `\n❌ ${errors.length} error(s)` : "\n✓ sitemap valid")
  process.exit(errors.length ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
