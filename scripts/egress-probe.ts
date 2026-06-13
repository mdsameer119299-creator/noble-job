/**
 * egress-probe.ts — Phase 0 read-only egress validation.
 *
 * Calls fetch() on every ENABLED ingestion adapter and reports, per source:
 *   reachable?  duration(ms)  rows discovered  failure reason
 *
 * Touches NO database (imports only the adapter registry, never govtAutoUpdate /
 * supabase). Purpose: confirm that Indian government sources are reachable from a
 * GitHub Actions runner's egress IP before migrating ingestion off the current
 * (Vercel-executed) path. Run identically locally for an A/B baseline.
 *
 *   tsx scripts/egress-probe.ts            # human + JSON to stdout
 *   tsx scripts/egress-probe.ts --out r.json
 */
import fs from "node:fs"

interface ProbeResult {
  id: string
  label: string
  kind: string
  reachable: boolean
  durationMs: number
  rows: number
  sampleTitle?: string
  error?: string
}

async function main() {
  const { enabledAdapters } = await import("@/lib/ingest/registry")
  const adapters = enabledAdapters()

  const env = {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    runner: process.env.GITHUB_ACTIONS ? "github-actions" : "local",
    region: process.env.RUNNER_OS || "local",
    ranAt: new Date().toISOString(),
  }

  console.log(`# Egress probe — ${env.runner} (${env.platform}, node ${env.node}) @ ${env.ranAt}`)
  console.log(`# Enabled adapters: ${adapters.map(a => a.id).join(", ")}\n`)

  const results: ProbeResult[] = []
  for (const a of adapters) {
    const t0 = Date.now()
    try {
      const raws = await a.fetch()
      const durationMs = Date.now() - t0
      results.push({
        id: a.id, label: a.label, kind: a.kind,
        reachable: true, durationMs, rows: raws.length,
        sampleTitle: raws[0]?.title,
      })
      console.log(`✓ ${a.id.padEnd(16)} ${String(durationMs).padStart(6)}ms  rows=${raws.length}  ${raws[0]?.title ?? "(no rows)"}`)
    } catch (e) {
      const durationMs = Date.now() - t0
      const error = (e as Error).message || String(e)
      // A thrown HTTP/TLS/timeout error means the network leg ran but failed:
      // distinguish "unreachable" (network refused/timeout/TLS) from "HTTP 4xx/5xx".
      const reachable = /HTTP \d{3}/.test(error) // got a response, just not ok
      results.push({ id: a.id, label: a.label, kind: a.kind, reachable, durationMs, rows: 0, error })
      console.log(`✗ ${a.id.padEnd(16)} ${String(durationMs).padStart(6)}ms  ${reachable ? "REACHED" : "UNREACHABLE"}  ${error}`)
    }
  }

  const report = { env, results }
  const outIdx = process.argv.indexOf("--out")
  if (outIdx !== -1 && process.argv[outIdx + 1]) {
    fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify(report, null, 2))
  }
  console.log("\n===JSON-REPORT-START===")
  console.log(JSON.stringify(report))
  console.log("===JSON-REPORT-END===")

  const ok = results.filter(r => r.rows > 0).length
  const reached = results.filter(r => r.reachable).length
  console.log(`\n# Summary: ${reached}/${results.length} reachable, ${ok}/${results.length} returned rows`)
}

main().catch(e => { console.error(e); process.exit(1) })
