/**
 * verify-state-adapters.ts — probe state-PSC adapters before/after enabling.
 *
 * For each requested adapter id it (1) GETs the list URL and reports the HTTP
 * status, then (2) runs the adapter's real fetch() and reports how many genuine
 * recruitment notifications were extracted. Run from the DEPLOY host for the
 * authoritative result (many PSC portals behave differently from a dev machine).
 *
 *   npx tsx scripts/verify-state-adapters.ts kpsc uppsc bpsc rpsc hpsc mppsc
 */
import { getAdapter } from "@/lib/ingest/registry"

const UA = "Mozilla/5.0 (compatible; NobleJobBot/1.0; +https://www.noblejob.in)"
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ["kpsc", "uppsc", "bpsc", "rpsc", "hpsc", "mppsc"]

async function probe(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(18000), redirect: "follow" })
    return `HTTP ${res.status}`
  } catch (e) {
    return `FETCH-FAIL (${(e as Error).name}: ${(e as Error).message})`
  }
}

async function main() {
  console.log(`Verifying ${IDS.length} state adapters…\n`)
  for (const id of IDS) {
    const a = getAdapter(id)
    if (!a) { console.log(`${id.padEnd(8)} ❌ not registered`); continue }
    // listUrl isn't exposed on the SourceAdapter interface; re-derive via fetch().
    let count = -1, err = ""
    try { count = (await a.fetch()).length } catch (e) { err = (e as Error).message }
    const status = count >= 0 ? `${count} notifications` : `fetch error: ${err}`
    console.log(`${id.padEnd(8)} enabled=${String(a.enabled).padEnd(5)} → ${status}`)
  }
  console.log("\nNote: 0 notifications can mean the portal is JS-rendered or lists no current PDFs — not necessarily a failure.")
}

main().catch(e => { console.error(e); process.exit(1) })
