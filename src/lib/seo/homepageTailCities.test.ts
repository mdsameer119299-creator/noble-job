/**
 * homepageTailCities.test.ts — the homepage tail-city links must come from ONE shared
 * snapshot (not 28 per-render queries) while keeping the exact qualification gate.
 *   npm run test:homepage-queries
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  loadHomepageTailCitySlugs,
  getQualifyingTailCitySlugsFromSnapshot,
  TAIL_CITIES,
  TAIL_CITY_MIN_JOBS,
  HOMEPAGE_TAIL_CITY_TTL_SECONDS,
} from "./tailCityLanding"
import type { GenuineOpenJobsSnapshot } from "./genuineJobs"
import type { Job } from "@/types/job"

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; process.stdout.write(`  PASS  ${name}\n`) }
  catch (e) { failed++; process.stderr.write(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}\n`) }
}

const city = TAIL_CITIES[0]
function job(i: number, location: string): Job {
  return { id: `synthetic-${i}`, title: `Role ${i}`, company: `Co ${i}`, location } as unknown as Job
}
const snap = (jobs: Job[]): GenuineOpenJobsSnapshot => ({ jobs, capped: false, fetchedTotal: jobs.length })

async function main() {
  await test("a city with >= TAIL_CITY_MIN_JOBS open jobs qualifies", async () => {
    const jobs = Array.from({ length: TAIL_CITY_MIN_JOBS }, (_, i) => job(i, city.locationQuery))
    assert.ok((await loadHomepageTailCitySlugs(async () => snap(jobs))).includes(city.slug))
  })
  await test("a city one job below the gate is hidden", async () => {
    const jobs = Array.from({ length: TAIL_CITY_MIN_JOBS - 1 }, (_, i) => job(i, city.locationQuery))
    assert.ok(!(await loadHomepageTailCitySlugs(async () => snap(jobs))).includes(city.slug))
  })
  await test("closed jobs removed from the snapshot drop the city (no indefinite staleness in the loader)", async () => {
    const open = Array.from({ length: TAIL_CITY_MIN_JOBS }, (_, i) => job(i, city.locationQuery))
    assert.ok((await loadHomepageTailCitySlugs(async () => snap(open))).includes(city.slug))
    assert.ok(!(await loadHomepageTailCitySlugs(async () => snap([]))).includes(city.slug))
  })
  await test("empty snapshot yields no cities (never fabricated)", async () => {
    assert.deepEqual(await loadHomepageTailCitySlugs(async () => snap([])), [])
  })
  await test("loader equals the sitemap's snapshot rule for the same data", async () => {
    const jobs = TAIL_CITIES.slice(0, 5).flatMap((c, ci) => Array.from({ length: TAIL_CITY_MIN_JOBS + ci }, (_, i) => job(ci * 100 + i, c.locationQuery)))
    assert.deepEqual(await loadHomepageTailCitySlugs(async () => snap(jobs)), getQualifyingTailCitySlugsFromSnapshot(snap(jobs)))
  })
  await test("a snapshot failure propagates (so unstable_cache never stores it)", async () => {
    await assert.rejects(loadHomepageTailCitySlugs(async () => { throw new Error("db down") }))
  })
  await test("freshness window is bounded (<= 10 minutes)", () => {
    assert.ok(HOMEPAGE_TAIL_CITY_TTL_SECONDS > 0 && HOMEPAGE_TAIL_CITY_TTL_SECONDS <= 600)
  })
  await test("homepage section no longer uses the per-city fan-out", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/home/PopularCitiesSection.tsx"), "utf8")
    assert.ok(!/getQualifyingTailCitySlugs\(/.test(src))
    assert.match(src, /getQualifyingTailCitySlugsForHomepage/)
  })
  await test("SEO callers (generateStaticParams / landing pages) still use the original live function", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/seo/tailCityLanding.ts"), "utf8")
    assert.match(src, /export async function getQualifyingTailCitySlugs\(\)/)
  })
  process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed ? 1 : 0)
}
main()
