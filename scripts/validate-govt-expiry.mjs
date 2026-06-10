/**
 * validate-govt-expiry.mjs
 *
 * Standalone validation script for the government-job expiry logic.
 * Run with:  node scripts/validate-govt-expiry.mjs
 *
 * This script replicates the same logic used in govtJobExpiry.ts and runs it
 * against the full fallback seed data so you can inspect exactly which jobs
 * would be shown vs hidden on any given day without starting the dev server.
 *
 * Exit code 0 = all assertions pass.
 * Exit code 1 = at least one assertion failed.
 */

import { parse, isBefore, startOfToday, format } from "date-fns"

// ── Replicate govtJobExpiry.ts logic (keeps script self-contained) ────────────

function parseLastDate(raw) {
  if (!raw || raw === "TBA" || raw === "-") return null
  const d = parse(raw.trim(), "dd MMM yyyy", new Date())
  return isNaN(d.getTime()) ? null : d
}

function isGovtJobExpired(lastDate) {
  const d = parseLastDate(lastDate)
  if (d === null) return false
  return isBefore(d, startOfToday())
}

// ── Fallback seed data (mirrored from fallbackJobs.ts) ────────────────────────

const FALLBACK_GOVT_JOBS = [
  { id: "sbi-apprentice-2026",     lastDate: "30 Jun 2026", tab: "latest",   status: "active" },
  { id: "iaf-afcat-02-2026",       lastDate: "15 Jun 2026", tab: "latest",   status: "active" },
  { id: "crpf-constable-2026",     lastDate: "30 Jun 2026", tab: "latest",   status: "active" },
  { id: "bob-credit-officer-2026", lastDate: "20 Jun 2026", tab: "latest",   status: "active" },
  { id: "ossc-je-2026",            lastDate: "25 Jun 2026", tab: "latest",   status: "active" },
  { id: "cnp-nashik-2026",         lastDate: "18 Jun 2026", tab: "latest",   status: "active" },
  { id: "secr-apprentice-2026",    lastDate: "25 Jun 2026", tab: "latest",   status: "active" },
  { id: "union-bank-credit-2026",  lastDate: "10 Jun 2026", tab: "latest",   status: "active" },
  { id: "upsc-cse-2026",           lastDate: "TBA",         tab: "upcoming", status: "active" },
  { id: "ssc-cgl-2026",            lastDate: "TBA",         tab: "upcoming", status: "active" },
  { id: "ibps-po-xiv-result",      lastDate: "-",           tab: "results",  status: "active" },
  { id: "ssc-chsl-result-2025",    lastDate: "-",           tab: "results",  status: "active" },
  { id: "railway-ntpc-result",     lastDate: "-",           tab: "results",  status: "active" },
  { id: "niacl-ao-result",         lastDate: "-",           tab: "results",  status: "active" },
  { id: "ibps-clerk-admit-2025",   lastDate: "31 Aug 2026", tab: "admit",    status: "active" },
  { id: "ssc-gd-admit-2026",       lastDate: "10 Jul 2026", tab: "admit",    status: "active" },
  { id: "navy-mr-admit-2026",      lastDate: "05 Jul 2026", tab: "admit",    status: "active" },
  { id: "ctet-answer-2025",        lastDate: "-",           tab: "answer",   status: "active" },
  { id: "ibps-rrb-answer-2025",    lastDate: "-",           tab: "answer",   status: "active" },
  { id: "ssc-mts-answer-2025",     lastDate: "-",           tab: "answer",   status: "active" },
]

// ── Run validation ─────────────────────────────────────────────────────────────

const today = startOfToday()
console.log(`\nValidating government job expiry logic`)
console.log(`Today: ${format(today, "dd MMM yyyy")}\n`)

let passed = 0
let failed = 0

// ── Unit tests for parseLastDate ───────────────────────────────────────────────

const unitCases = [
  { input: "15 Jun 2026", expectNull: false, expectExpired: false, label: "future date not expired" },
  { input: "01 Jan 2025", expectNull: false, expectExpired: true,  label: "clearly past date is expired" },
  { input: "08 Jun 2026", expectNull: false, expectExpired: true,  label: "08 Jun 2026 is 2 days ago (expired)" },
  { input: "TBA",         expectNull: true,  expectExpired: false, label: "TBA → not expired" },
  { input: "-",           expectNull: true,  expectExpired: false, label: "dash → not expired" },
  { input: "",            expectNull: true,  expectExpired: false, label: "empty string → not expired" },
  { input: undefined,     expectNull: true,  expectExpired: false, label: "undefined → not expired" },
  { input: "invalid",     expectNull: true,  expectExpired: false, label: "garbage string → not expired" },
]

console.log("── Unit tests ──────────────────────────────────────────────────────")
for (const { input, expectNull, expectExpired, label } of unitCases) {
  const parsed   = parseLastDate(input)
  const expired  = isGovtJobExpired(input)
  const okNull   = expectNull ? parsed === null : parsed !== null
  const okExpiry = expired === expectExpired
  const ok = okNull && okExpiry
  console.log(`  ${ok ? "✅" : "❌"} ${label}`)
  if (!ok) {
    if (!okNull)   console.log(`     parseLastDate("${input}") → ${parsed}, expected ${expectNull ? "null" : "Date"}`)
    if (!okExpiry) console.log(`     isGovtJobExpired("${input}") → ${expired}, expected ${expectExpired}`)
    failed++
  } else {
    passed++
  }
}

// ── Fallback data audit ────────────────────────────────────────────────────────

console.log("\n── Fallback seed data audit ────────────────────────────────────────")
const shown   = FALLBACK_GOVT_JOBS.filter(j => j.status !== "expired" && !isGovtJobExpired(j.lastDate))
const hidden  = FALLBACK_GOVT_JOBS.filter(j => j.status === "expired"  || isGovtJobExpired(j.lastDate))

console.log(`  Total seed jobs : ${FALLBACK_GOVT_JOBS.length}`)
console.log(`  Would be shown  : ${shown.length}`)
console.log(`  Would be hidden : ${hidden.length}`)

if (hidden.length) {
  console.log("\n  Hidden (expired) jobs:")
  for (const j of hidden) {
    console.log(`    - ${j.id}  lastDate=${j.lastDate}  status=${j.status}`)
  }
}

// ── Safety check: jobs with future dates must never be hidden ─────────────────

console.log("\n── Safety checks ───────────────────────────────────────────────────")
const futureDates = ["15 Jun 2026", "30 Jun 2026", "20 Jun 2026", "25 Jun 2026",
                     "18 Jun 2026", "10 Jul 2026", "05 Jul 2026", "31 Aug 2026"]
for (const d of futureDates) {
  const expired = isGovtJobExpired(d)
  const ok = !expired
  console.log(`  ${ok ? "✅" : "❌"} ${d} should NOT be expired → isGovtJobExpired=${expired}`)
  ok ? passed++ : failed++
}

// Jobs on the results/admit/answer tabs use "-" and must never be hidden
const dashJobs = FALLBACK_GOVT_JOBS.filter(j => j.lastDate === "-")
for (const j of dashJobs) {
  const ok = !isGovtJobExpired(j.lastDate)
  console.log(`  ${ok ? "✅" : "❌"} "${j.id}" (lastDate="-") should never be hidden`)
  ok ? passed++ : failed++
}

// TBA jobs must never be hidden
const tbaJobs = FALLBACK_GOVT_JOBS.filter(j => j.lastDate === "TBA")
for (const j of tbaJobs) {
  const ok = !isGovtJobExpired(j.lastDate)
  console.log(`  ${ok ? "✅" : "❌"} "${j.id}" (lastDate="TBA") should never be hidden`)
  ok ? passed++ : failed++
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Result ──────────────────────────────────────────────────────────`)
console.log(`  Passed : ${passed}`)
console.log(`  Failed : ${failed}`)

if (failed > 0) {
  console.log("\n  ❌  Some assertions failed — check output above.\n")
  process.exit(1)
} else {
  console.log("\n  ✅  All assertions passed.\n")
  process.exit(0)
}
