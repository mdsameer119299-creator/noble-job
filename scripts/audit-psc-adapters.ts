/**
 * Live audit of every registered State-PSC adapter.
 * Stage 1: reachability + PDF-anchor detection + JS/CAPTCHA heuristics (list GET).
 * Stage 2: run the REAL adapter fetch() to count genuinely extracted notifications.
 * Read-only; touches no DB. Run: npx tsx scripts/audit-psc-adapters.ts
 */
import { STATE_PSC_ADAPTERS } from "../src/lib/ingest/adapters/statePsc"

const UA = "Mozilla/5.0 (compatible; NobleJobBot/1.0; +https://www.noblejob.in)"
const ANCHOR_HINT = /recruit|advert|advt|vacanc|\bpost\b|junior exec|engineer|officer|trainee|apprentice|scientist|consultant|faculty|applications?\s+invited|notification/i

// URL map mirrors statePsc.ts (listUrl isn't exposed on the adapter object).
const URLS: Record<string, string> = {
  kpsc: "https://www.kpsc.kar.nic.in/", uppsc: "https://uppsc.up.nic.in/",
  bpsc: "https://www.bpsc.bih.nic.in/", mpsc: "https://mpsc.gov.in/",
  rpsc: "https://rpsc.rajasthan.gov.in/", tspsc: "https://www.tspsc.gov.in/",
  appsc: "https://psc.ap.gov.in/", ukpsc: "https://ukpsc.gov.in/",
  hppsc: "https://www.hppsc.hp.gov.in/hppsc/", gpsc: "https://gpsc.gujarat.gov.in/",
  mppsc: "https://mppsc.mp.gov.in/", wbpsc: "https://wbpsc.gov.in/",
  tnpsc: "https://www.tnpsc.gov.in/", "kerala-psc": "https://www.keralapsc.gov.in/",
  opsc: "https://www.opsc.gov.in/",
}

function abs(href: string, base: string): string | null {
  try { return new URL(href, base).href } catch { return null }
}

interface Row {
  id: string; label: string; url: string
  reachable: string; status: string
  pdfTotal: number; pdfRecruit: number
  needsJs: string; captcha: string
  extracted: number | string
  ready: string; note: string
}

async function probeList(url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(20000), redirect: "follow" })
    const html = await res.text().catch(() => "")
    return { ok: res.ok, status: String(res.status), html }
  } catch (e) {
    return { ok: false, status: (e as Error).name === "TimeoutError" ? "timeout" : (e as Error).message.slice(0, 40), html: "" }
  }
}

function analyze(html: string, base: string) {
  const seen = new Set<string>()
  let pdfTotal = 0, pdfRecruit = 0
  for (const a of html.matchAll(/<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const u = abs(a[1], base); if (!u || seen.has(u)) continue; seen.add(u)
    pdfTotal++
    const anchor = a[2].replace(/<[^>]+>/g, " ").trim()
    if (ANCHOR_HINT.test(anchor || u)) pdfRecruit++
  }
  // JS-rendering heuristics: empty SPA shell / framework markers + sparse text.
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const spaMarker = /__NEXT_DATA__|ng-app|ng-version|data-reactroot|id="root">\s*<\/div>|id="app">\s*<\/div>|vue|window\.__NUXT__/i.test(html)
  const needsJs = (pdfTotal === 0 && (spaMarker || text.length < 600))
  const captcha = /recaptcha|g-recaptcha|hcaptcha|grecaptcha|captcha/i.test(html)
  return { pdfTotal, pdfRecruit, needsJs, captcha, textLen: text.length }
}

async function run() {
  const rows: Row[] = []
  for (const ad of STATE_PSC_ADAPTERS) {
    const url = URLS[ad.id] ?? "(unknown)"
    process.stderr.write(`probing ${ad.id} … `)
    const list = await probeList(url)
    const a = list.html ? analyze(list.html, url) : { pdfTotal: 0, pdfRecruit: 0, needsJs: !list.ok, captcha: false, textLen: 0 }

    let extracted: number | string = "—"
    let note = ""
    // Stage 2: only run the heavy real fetch when the list page yielded recruitment PDFs.
    if (list.ok && a.pdfRecruit > 0) {
      try {
        const raws = await Promise.race([
          ad.fetch(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("fetch-timeout")), 60000)),
        ])
        extracted = raws.length
        if (raws[0]) note = raws[0].title.slice(0, 50)
      } catch (e) {
        extracted = "err"
        note = (e as Error).message.slice(0, 40)
      }
    } else if (!list.ok) {
      note = `list ${list.status}`
    } else if (a.needsJs) {
      note = "JS shell — no server-rendered PDFs"
    } else {
      note = a.pdfTotal > 0 ? `${a.pdfTotal} PDFs, none recruitment-tagged` : "no PDF links in HTML"
    }

    const ready = list.ok && typeof extracted === "number" && extracted > 0 && !a.captcha ? "Y" : "N"
    rows.push({
      id: ad.id, label: ad.label, url,
      reachable: list.ok ? "Y" : "N", status: list.status,
      pdfTotal: a.pdfTotal, pdfRecruit: a.pdfRecruit,
      needsJs: a.needsJs ? "Y" : "N", captcha: a.captcha ? "Y" : "N",
      extracted, ready, note,
    })
    process.stderr.write(`reachable=${list.ok?"Y":"N"} pdfs=${a.pdfTotal}/${a.pdfRecruit} extracted=${extracted}\n`)
  }

  // Markdown table
  console.log("\n| Adapter | URL | Reachable | HTTP | PDF links | Recruit PDFs | Needs JS | CAPTCHA | Extracted | Ready | Note |")
  console.log("|---|---|---|---|---|---|---|---|---|---|---|")
  for (const r of rows) {
    console.log(`| ${r.label} | ${r.url} | ${r.reachable} | ${r.status} | ${r.pdfTotal} | ${r.pdfRecruit} | ${r.needsJs} | ${r.captcha} | ${r.extracted} | ${r.ready} | ${r.note} |`)
  }
  const ready = rows.filter(r => r.ready === "Y")
  console.log(`\nREADY (enable): ${ready.length ? ready.map(r => r.id).join(", ") : "none"}`)
}

run()
