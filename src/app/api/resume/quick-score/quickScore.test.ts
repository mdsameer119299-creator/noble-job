/**
 * quickScore.test.ts — security + behaviour tests for POST /api/resume/quick-score
 * and the shared resume parser limits (no framework; run with tsx).
 *   npm run test:resume-security
 *
 * Uses SYNTHETIC fixtures only and an injected in-memory rate-limit backend:
 * no network, no database, no real candidate data.
 */
import assert from "node:assert/strict"
import zlib from "node:zlib"
import type { NextRequest } from "next/server"
import { POST } from "./route"
import { QUICK_SCORE_RATE_POLICY } from "@/lib/resume/quickScorePolicy"
import { POST as candidateScorePOST } from "../../candidate/resume-score/route"
import { extractResumeText, DOCX_MAX_UNCOMPRESSED_BYTES, PDF_MAX_PAGES } from "@/lib/resume/parse"
import { parserUnavailableResponse } from "@/lib/resume/parseFailure"
import { hasValidResumeSignature } from "@/lib/resume/fileSignature"
import { setRateLimitBackend, type RateLimitBackend } from "@/lib/security/distributedRateLimit"
import { RESUME_MAX_BYTES } from "@/lib/utils/resumeUpload"

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    passed++
    process.stdout.write(`  PASS  ${name}\n`)
  } catch (err) {
    failed++
    process.stderr.write(`  FAIL  ${name}\n        ${(err as Error).message.split("\n").slice(0, 3).join(" | ")}\n`)
  }
}

// ── fixtures ────────────────────────────────────────────────────────────────
const MARKER = "ZXQ-SYNTHETIC-CANDIDATE-7731"
const RESUME_TEXT = `${MARKER} Software Engineer skills Python JavaScript SQL experience 2019-2024 built APIs led team of four`

function buildPdf(pages: number, text = RESUME_TEXT): Buffer {
  const objs: string[] = []
  const kids: string[] = []
  objs.push("") // 1 catalog (filled later)
  objs.push("") // 2 pages (filled later)
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>") // 3 font
  for (let i = 0; i < pages; i++) {
    // pdf.js rejects very long string tokens, so emit one short line per Tj.
    const lines = text.match(/.{1,50}(\s|$)/g) ?? [text]
    const content = `BT /F1 12 Tf 50 750 Td 14 TL ${lines.map(l => `(${l.trim()}) Tj T*`).join(" ")} ET`
    const cObj = objs.length + 2 // content obj number (1-based) computed below
    const pageNum = objs.length + 1
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNum + 1} 0 R >>`)
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    kids.push(`${pageNum} 0 R`)
    void cObj
  }
  objs[0] = "<< /Type /Catalog /Pages 2 0 R >>"
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages} >>`
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach(o => { out += `${String(o).padStart(10, "0")} 00000 n \n` })
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, "latin1")
}

function crc32(buf: Buffer): number {
  let c, crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Minimal single-entry (word/document.xml) zip. `declaredSize` lets tests forge the header. */
function buildDocx(xml: Buffer, opts: { declaredSize?: number } = {}): Buffer {
  const name = Buffer.from("word/document.xml")
  const comp = zlib.deflateRawSync(xml)
  const crc = crc32(xml)
  const declared = opts.declaredSize ?? xml.length
  const lh = Buffer.alloc(30)
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8)
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(declared, 22); lh.writeUInt16LE(name.length, 26)
  const local = Buffer.concat([lh, name, comp])
  const ch = Buffer.alloc(46)
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10)
  ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(declared, 24); ch.writeUInt16LE(name.length, 28)
  ch.writeUInt32LE(0, 42)
  const central = Buffer.concat([ch, name])
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length, 16)
  return Buffer.concat([local, central, eocd])
}
const docxXml = (text: string) =>
  Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`)

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

async function uploadRequest(
  file: Buffer | null,
  name: string,
  type: string,
  hdr: { contentLength?: number | null; ip?: string } = {},
): Promise<NextRequest> {
  const fd = new FormData()
  if (file) fd.append("file", new File([new Uint8Array(file)], name, { type }))
  const tmp = new Request("http://localhost/api/resume/quick-score", { method: "POST", body: fd })
  const bytes = new Uint8Array(await tmp.arrayBuffer())
  const headers: Record<string, string> = {
    "content-type": tmp.headers.get("content-type")!,
    "x-forwarded-for": hdr.ip ?? "203.0.113.7",
  }
  if (hdr.contentLength !== null) headers["content-length"] = String(hdr.contentLength ?? bytes.length)
  return new Request("http://localhost/api/resume/quick-score", { method: "POST", headers, body: bytes }) as unknown as NextRequest
}

/** In-memory backend with the same semantics as the DB-backed one. */
function memoryBackend(): RateLimitBackend & { hits: { scope: string; key: string; at: number }[] } {
  const hits: { scope: string; key: string; at: number }[] = []
  return {
    hits,
    async count(scope, key, windowMs) {
      const since = Date.now() - windowMs
      return hits.filter(h => h.scope === scope && h.at > since && (key === null || h.key === key)).length
    },
    async record(scope, key) { hits.push({ scope, key, at: Date.now() }); return String(hits.length - 1) },
    async remove(_scope, id) { const h = hits[Number(id)]; if (h) h.at = 0 },
  }
}

async function main() {
  // Capture console so we can prove no resume content is ever logged.
  const logged: string[] = []
  for (const m of ["log", "warn", "error", "info", "debug"] as const) {
    const orig = console[m].bind(console)
    void orig
    console[m] = (...a: unknown[]) => { logged.push(a.map(String).join(" ")) }
  }
  const say = (s: string) => process.stdout.write(s + "\n")
  void say

  setRateLimitBackend(memoryBackend())

  await test("valid PDF is accepted without authentication (public endpoint)", async () => {
    const res = await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip: "198.51.100.1" }))
    const j = await res.json()
    assert.equal(res.status, 200, JSON.stringify(j))
    assert.ok(typeof j.data.overallScore === "number")
    assert.ok(!JSON.stringify(j).includes(MARKER), "raw resume text must never be echoed")
    assert.equal(res.headers.get("cache-control"), "no-store")
  })

  await test("valid DOCX is accepted", async () => {
    const res = await POST(await uploadRequest(buildDocx(docxXml(RESUME_TEXT)), "cv.docx", DOCX_MIME, { ip: "198.51.100.2" }))
    assert.equal(res.status, 200)
    assert.ok(!JSON.stringify(await res.json()).includes(MARKER))
  })

  await test("oversized Content-Length is rejected (413) WITHOUT reading the body", async () => {
    let armed = false
    let bodyRead = false
    // undici primes the stream while constructing the Request, so only reads AFTER the handler starts count.
    const stream = new ReadableStream<Uint8Array>({ pull(c) { if (armed) bodyRead = true; c.enqueue(new Uint8Array(1024)) } })
    const req = new Request("http://localhost/api/resume/quick-score", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(RESUME_MAX_BYTES + 10 * 1024 * 1024), "x-forwarded-for": "198.51.100.3" },
      body: stream,
      // @ts-expect-error undici requires duplex for streaming bodies
      duplex: "half",
    }) as unknown as NextRequest
    await new Promise(r => setTimeout(r, 50)) // let undici finish priming the stream
    armed = true
    const res = await POST(req)
    assert.equal(res.status, 413)
    assert.equal(bodyRead, false)
  })

  await test("oversized file with an honest Content-Length is rejected (413)", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(RESUME_MAX_BYTES + 100_000, 0x20)])
    const res = await POST(await uploadRequest(big, "big.pdf", "application/pdf", { ip: "198.51.100.4" }))
    assert.equal(res.status, 413)
  })

  const padTo = (n: number) => { const b = buildPdf(1); assert.ok(b.length < n); return Buffer.concat([b, Buffer.alloc(n - b.length, 0x20)]) }
  await test("4 MB limit: a file of exactly RESUME_MAX_BYTES is accepted (200)", async () => {
    assert.equal(RESUME_MAX_BYTES, 4 * 1024 * 1024)
    const res = await POST(await uploadRequest(padTo(RESUME_MAX_BYTES), "cv.pdf", "application/pdf", { ip: "198.51.100.30" }))
    assert.equal(res.status, 200)
  })
  await test("4 MB limit: a file just below the limit is accepted (200)", async () => {
    const res = await POST(await uploadRequest(padTo(RESUME_MAX_BYTES - 1), "cv.pdf", "application/pdf", { ip: "198.51.100.31" }))
    assert.equal(res.status, 200)
  })
  await test("4 MB limit: RESUME_MAX_BYTES + 1 → 413 with friendly, consistent JSON", async () => {
    const res = await POST(await uploadRequest(padTo(RESUME_MAX_BYTES + 1), "cv.pdf", "application/pdf", { ip: "198.51.100.32" }))
    assert.equal(res.status, 413)
    const j = await res.json()
    assert.equal(j.code, "file_too_large")
    assert.equal(j.maxBytes, RESUME_MAX_BYTES)
    assert.match(j.error, /larger than 4 MB/)
    assert.match(res.headers.get("content-type") ?? "", /json/)
  })
  await test("4 MB limit: streamed-body cap also returns the same friendly JSON (not 'Upload is too large.')", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(RESUME_MAX_BYTES + 200_000, 0x20)])
    const res = await POST(await uploadRequest(big, "big.pdf", "application/pdf", { ip: "198.51.100.33", contentLength: 1000 }))
    assert.equal(res.status, 413)
    assert.equal((await res.json()).code, "file_too_large")
  })
  await test("4 MB limit: stays below Vercel's 4.5 MB request cap including multipart framing", async () => {
    const req = await uploadRequest(padTo(RESUME_MAX_BYTES), "cv.pdf", "application/pdf", { ip: "198.51.100.34" })
    assert.ok(Number(req.headers.get("content-length")) < 4.5 * 1024 * 1024)
  })

  await test("lying Content-Length (small header, large streamed body) is cut off by the byte cap (413)", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(RESUME_MAX_BYTES + 200_000, 0x20)])
    const honest = await uploadRequest(big, "big.pdf", "application/pdf", { ip: "198.51.100.5", contentLength: 1000 })
    const res = await POST(honest)
    assert.equal(res.status, 413)
  })

  await test("missing Content-Length is rejected (411)", async () => {
    const res = await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip: "198.51.100.6", contentLength: null }))
    assert.equal(res.status, 411)
  })

  await test("non-numeric Content-Length is rejected (400)", async () => {
    const req = await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip: "198.51.100.7" })
    req.headers.set("content-length", "12abc")
    assert.equal((await POST(req)).status, 400)
  })

  await test("non-multipart body is rejected (415)", async () => {
    const req = new Request("http://localhost/api/resume/quick-score", {
      method: "POST", headers: { "content-type": "application/json", "content-length": "2", "x-forwarded-for": "198.51.100.8" }, body: "{}",
    }) as unknown as NextRequest
    assert.equal((await POST(req)).status, 415)
  })

  await test("missing file field is rejected (400)", async () => {
    assert.equal((await POST(await uploadRequest(null, "", "", { ip: "198.51.100.9" }))).status, 400)
  })

  await test("signature: ZIP bytes named .pdf are rejected (415)", async () => {
    const res = await POST(await uploadRequest(buildDocx(docxXml(RESUME_TEXT)), "cv.pdf", "application/pdf", { ip: "198.51.100.10" }))
    assert.equal(res.status, 415)
  })
  await test("signature: PDF bytes named .docx are rejected (415)", async () => {
    assert.equal((await POST(await uploadRequest(buildPdf(1), "cv.docx", DOCX_MIME, { ip: "198.51.100.10" }))).status, 415)
  })
  await test("signature: plain text / script named .pdf is rejected (415)", async () => {
    const res = await POST(await uploadRequest(Buffer.from("<?php echo 1; ?> not a pdf at all"), "cv.pdf", "application/pdf", { ip: "198.51.100.10" }))
    assert.equal(res.status, 415)
  })
  await test("signature: disallowed extension is rejected (415)", async () => {
    assert.equal((await POST(await uploadRequest(buildPdf(1), "cv.exe", "application/pdf", { ip: "198.51.100.10" }))).status, 415)
  })
  await test("hasValidResumeSignature unit checks", () => {
    assert.equal(hasValidResumeSignature(Buffer.from("%PDF-1.7"), "pdf"), true)
    assert.equal(hasValidResumeSignature(Buffer.from("PK\x03\x04zz", "latin1"), "docx"), true)
    assert.equal(hasValidResumeSignature(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]), "doc"), true)
    assert.equal(hasValidResumeSignature(Buffer.from("PK\x03\x04", "latin1"), "pdf"), false)
    assert.equal(hasValidResumeSignature(Buffer.alloc(0), "pdf"), false)
  })

  await test("ZIP bomb: honestly-declared huge DOCX entry is rejected before inflating", async () => {
    const xml = Buffer.alloc(DOCX_MAX_UNCOMPRESSED_BYTES + 1024 * 1024, 0x41)
    const r = await extractResumeText(buildDocx(xml), "docx")
    assert.equal(r.text, "")
    assert.match(r.warning || "", /too large or complex/i)
  })
  await test("ZIP bomb: forged small declared size is still capped by maxOutputLength", async () => {
    const xml = Buffer.alloc(200 * 1024 * 1024, 0x41) // ~200 MB of 'A' deflates to ~200 KB
    const bomb = buildDocx(xml, { declaredSize: 1000 })
    assert.ok(bomb.length < 1024 * 1024, "fixture should be small on the wire")
    const before = process.memoryUsage().rss
    const r = await extractResumeText(bomb, "docx")
    assert.equal(r.text, "")
    assert.match(r.warning || "", /too large or complex/i)
    assert.ok(process.memoryUsage().rss - before < 120 * 1024 * 1024, "inflate must not balloon memory")
  })
  await test("ZIP bomb through the HTTP route returns 422 with a generic message", async () => {
    const bomb = buildDocx(Buffer.alloc(150 * 1024 * 1024, 0x41), { declaredSize: 10 })
    const res = await POST(await uploadRequest(bomb, "cv.docx", DOCX_MIME, { ip: "198.51.100.11" }))
    assert.equal(res.status, 422)
    assert.ok(!/stack|node_modules|\/home\//i.test(JSON.stringify(await res.json())))
  })
  await test("truncated / corrupt DOCX fails safely", async () => {
    const good = buildDocx(docxXml(RESUME_TEXT))
    const r = await extractResumeText(good.subarray(0, good.length - 40), "docx")
    assert.equal(r.text, "")
    assert.ok(r.warning)
  })

  await test("invalid PDF (valid header, garbage body) returns 422 with no internal details", async () => {
    const res = await POST(await uploadRequest(Buffer.from("%PDF-1.4\nthis is not a real pdf \u0000\u0001 garbage"), "cv.pdf", "application/pdf", { ip: "198.51.100.12" }))
    assert.equal(res.status, 422)
    const body = JSON.stringify(await res.json())
    assert.ok(!/node_modules|\/home\/|\bat \w+.*:\d+|pdf\.js|Invalid PDF structure/i.test(body), body)
  })
  await test("PDF with too many pages is rejected (422)", async () => {
    const res = await POST(await uploadRequest(buildPdf(PDF_MAX_PAGES + 25), "cv.pdf", "application/pdf", { ip: "198.51.100.13" }))
    assert.equal(res.status, 422)
    assert.match(JSON.stringify(await res.json()), /too many pages/i)
  })
  await test("PDF at exactly the page limit is accepted", async () => {
    const r = await extractResumeText(buildPdf(PDF_MAX_PAGES), "pdf")
    assert.ok(r.text.includes(MARKER), r.warning)
  })

  await test("parser stays healthy: valid PDFs always parse after failures / over-limit files (no stale pdf.js state)", async () => {
    const garbage = Buffer.from("%PDF-1.4\nxx\n%%EOF garbage \u0000\u0001 garbage")
    for (let round = 0; round < 6; round++) {
      await extractResumeText(garbage, "pdf")
      await extractResumeText(buildPdf(PDF_MAX_PAGES + 1), "pdf")
      assert.ok((await extractResumeText(buildPdf(1), "pdf")).text.includes(MARKER), `round ${round}: valid PDF after failures`)
      assert.ok((await extractResumeText(buildPdf(PDF_MAX_PAGES), "pdf")).text.includes(MARKER))
    }
    // overlapping parses: up to the worker cap run; extras are told "busy" (503), never corrupted
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => extractResumeText(buildPdf(2), "pdf")))
    assert.ok(concurrent.filter(r => r.text.includes(MARKER)).length >= 2, "at least the permitted parses succeed")
    assert.ok(concurrent.every(r => r.text.includes(MARKER) || r.code === "busy"), "the rest are 'busy', nothing is misread")
  })
  await test("rate limit: 6th request from one client in the window gets 429 + Retry-After", async () => {
    setRateLimitBackend(memoryBackend())
    const ip = "198.51.100.50"
    for (let i = 0; i < QUICK_SCORE_RATE_POLICY.perClient.max; i++) {
      { const rr = await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip })); assert.equal(rr.status, 200, `request ${i + 1} ` + JSON.stringify(await rr.clone().json())) }
    }
    const res = await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip }))
    assert.equal(res.status, 429)
    assert.ok(Number(res.headers.get("retry-after")) > 0)
  })
  await test("rate limit: another client is unaffected", async () => {
    assert.equal((await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip: "198.51.100.51" }))).status, 200)
  })
  await test("rate limit: state is shared through the backend (simulates a second serverless instance)", async () => {
    const shared = memoryBackend()
    setRateLimitBackend(shared)
    const ip = "198.51.100.52"
    for (let i = 0; i < 5; i++) await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip }))
    setRateLimitBackend(shared) // a "new instance" reading the same store
    assert.equal((await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip }))).status, 429)
  })
  await test("rate limit: global ceiling blocks even a fresh client", async () => {
    const b = memoryBackend()
    for (let i = 0; i < QUICK_SCORE_RATE_POLICY.global.max; i++) b.hits.push({ scope: QUICK_SCORE_RATE_POLICY.scope, key: `k${i}`, at: Date.now() })
    setRateLimitBackend(b)
    assert.equal((await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip: "198.51.100.53" }))).status, 429)
  })
  await test("rate limit: store outage degrades to per-instance limiting (still limits, never 500)", async () => {
    setRateLimitBackend({ count: async () => { throw new Error("db down") }, record: async () => { throw new Error("db down") }, remove: async () => { throw new Error("db down") } })
    const ip = "198.51.100.54"
    let last = 0
    for (let i = 0; i < 7; i++) last = (await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip }))).status
    assert.equal(last, 429)
  })
  setRateLimitBackend(memoryBackend())

  await test("FAIL-SAFE: PDF_PARSING_ENABLED=false -> public route 503+Retry-After for PDF; DOCX and TXT keep working", async () => {
    const prev = process.env.PDF_PARSING_ENABLED
    process.env.PDF_PARSING_ENABLED = "false"
    try {
      const pdf = await POST(await uploadRequest(buildPdf(1), "cv.pdf", "application/pdf", { ip: "198.51.100.80" }))
      assert.equal(pdf.status, 503)
      assert.equal(pdf.headers.get("retry-after"), "30")
      const docx = await POST(await uploadRequest(buildDocx(docxXml(RESUME_TEXT)), "cv.docx", DOCX_MIME, { ip: "198.51.100.81" }))
      assert.equal(docx.status, 200)
      const txt = await extractResumeText(Buffer.from(RESUME_TEXT), "txt")
      assert.ok(txt.text.includes(MARKER) && !txt.code)
      const doc = await extractResumeText(Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from(RESUME_TEXT)]), "doc")
      assert.ok(!doc.code, "DOC path never touches the PDF kill-switch")
      const d2 = await extractResumeText(buildDocx(docxXml(RESUME_TEXT)), "docx")
      assert.ok(d2.text.includes(MARKER) && !d2.code)
    } finally {
      if (prev === undefined) delete process.env.PDF_PARSING_ENABLED
      else process.env.PDF_PARSING_ENABLED = prev
    }
  })

  await test("FAIL-SAFE: candidate scorer maps disabled/busy PDF parsing to 503 (not a 422 'bad file')", async () => {
    const prev = process.env.PDF_PARSING_ENABLED
    process.env.PDF_PARSING_ENABLED = "false"
    try {
      const parsed = await extractResumeText(buildPdf(1), "pdf")
      assert.equal(parsed.code, "unavailable")
      assert.equal(parserUnavailableResponse(parsed)?.status, 503)
      assert.equal(parserUnavailableResponse({ code: "busy", warning: "x" })?.headers["Retry-After"], "30")
      assert.equal(parserUnavailableResponse({ warning: "too large" }), null, "ordinary failures stay 422 in the route")
    } finally {
      if (prev === undefined) delete process.env.PDF_PARSING_ENABLED
      else process.env.PDF_PARSING_ENABLED = prev
    }
  })

  await test("unauthenticated access to the AUTHENTICATED candidate scorer is denied", async () => {
    const req = new Request("http://localhost/api/candidate/resume-score", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }) as unknown as NextRequest
    const res = await candidateScorePOST(req)
    assert.ok([401, 403, 503].includes(res.status), `status ${res.status}`)
  })

  await test("no resume content or extracted personal data was ever logged", () => {
    assert.ok(!logged.some(l => l.includes(MARKER)), "marker leaked into logs")
  })

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed ? 1 : 0)
}
main()
