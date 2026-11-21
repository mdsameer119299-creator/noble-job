import assert from "node:assert/strict"
import { metadata } from "./page"

const m = metadata as { title?: string | { absolute?: string }; description?: string; alternates?: { canonical?: string } }

const title = typeof m.title === "string" ? m.title : m.title?.absolute ?? ""
assert.ok(title.length >= 30 && title.length <= 75, "title length is search-friendly")
assert.ok(m.description && m.description.length >= 110 && m.description.length <= 175, "description length is search-friendly")
assert.ok(m.alternates?.canonical?.endsWith("/for-employers"), "self canonical")
// No pricing claims or invented statistics: this page promises only free-to-start posting.
assert.ok(!/[₹$]\s?\d/.test(String(m.description)), "no price figures in description")
// Whole page source: free + manually reviewed, and no paid/pricing/"future plans" language anywhere.
import { readFileSync } from "node:fs"
const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
assert.ok(!/paid|pricing|premium|upgrade|in future|subscription|\bplans?\b|[₹$]\s?\d/i.test(src), "no pricing / paid / future-plan language on /for-employers")
assert.match(src, /registration and job posting are free/i, "FAQ states registration and posting are free")
console.log("forEmployers metadata: OK")
