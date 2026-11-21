/**
 * pdfIsolation.test.ts — proves the PDF resource limits are ENFORCED (not just awaited):
 * hostile worker scripts must be killed, the host process must survive, and the response must
 * return promptly. Synthetic data only.
 *   npm run test:pdf-isolation
 */
import assert from "node:assert/strict"
import zlib from "node:zlib"
import {
  runLimitedWorker, parsePdfIsolated, PDF_MAX_CONCURRENT, PDF_MAX_PAGES, PDF_MAX_TEXT_CHARS,
  pdfParsingEnabled, type WorkerLimits,
} from "./pdfIsolated"
import { extractResumeText } from "./parse"

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; process.stdout.write(`  PASS  ${name}\n`) }
  catch (e) { failed++; process.stderr.write(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}\n`) }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const LIMITS: WorkerLimits = { timeoutMs: 1500, heapMb: 64, maxWorkerBytes: 96 * 1024 * 1024 }

const MARKER = "ZXQ-SYNTHETIC-CANDIDATE-7731"
const RESUME_TEXT = `${MARKER} Software Engineer skills Python JavaScript SQL experience 2019-2024 built APIs led team of four`

/** Hand-built PDF. `extraObjects` are raw object bodies appended after the page tree (for hostile streams). */
function buildPdf(pages = 1, text = RESUME_TEXT, extraObjects: Buffer[] = []): Buffer {
  const parts: Buffer[] = []
  const offsets: number[] = []
  let len = 0
  const push = (b: Buffer | string) => { const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b; parts.push(buf); len += buf.length }
  const objs: (Buffer | string)[] = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
  const kids: string[] = []
  for (let i = 0; i < pages; i++) {
    const lines = text.match(/.{1,50}(\s|$)/g) ?? [text]
    const content = `BT /F1 12 Tf 50 750 Td 14 TL ${lines.map(l => `(${l.trim()}) Tj T*`).join(" ")} ET`
    const pageNum = objs.length + 1
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNum + 1} 0 R >>`)
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    kids.push(`${pageNum} 0 R`)
  }
  objs[0] = "<< /Type /Catalog /Pages 2 0 R >>"
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages} >>`
  for (const e of extraObjects) objs.push(e)
  push("%PDF-1.4\n")
  objs.forEach((o, i) => {
    offsets.push(len)
    push(`${i + 1} 0 obj\n`); push(o); push("\nendobj\n")
  })
  const xref = len
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`)
  offsets.forEach(o => push(`${String(o).padStart(10, "0")} 00000 n \n`))
  push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(parts)
}
const flateObject = (raw: Buffer) => {
  const z = zlib.deflateSync(raw)
  return Buffer.concat([Buffer.from(`<< /Length ${z.length} /Filter /FlateDecode >>\nstream\n`, "latin1"), z, Buffer.from("\nendstream", "latin1")])
}

async function main() {
  const heapBefore = process.memoryUsage().heapUsed
  const rssBefore = process.memoryUsage().rss

  // ── real limits, proven with hostile worker scripts ──
  await test("UNAVAILABLE: if the Worker cannot be constructed, parsing fails closed as 'unavailable'", async () => {
    // A real synchronous constructor failure, not a mock of the outcome.
    const r = await runLimitedWorker("1", { notCloneable: () => 1 }, LIMITS) // DataCloneError thrown by the real constructor
    assert.deepEqual(r, { ok: false, reason: "unavailable" })
  })

  await test("TIME: an infinite CPU loop is terminated at the timeout and the host stays responsive", async () => {
    let ticks = 0
    const iv = setInterval(() => ticks++, 20)
    const t0 = Date.now()
    const r = await runLimitedWorker("while (true) {}", {}, LIMITS)
    const dt = Date.now() - t0
    clearInterval(iv)
    assert.deepEqual(r, { ok: false, reason: "timeout" })
    assert.ok(dt >= LIMITS.timeoutMs - 50 && dt < LIMITS.timeoutMs + 1000, `took ${dt}ms`)
    assert.ok(ticks > 20, "the main event loop kept running while the worker spun")
  })
  await test("TIME: after the kill, the runaway thread is really gone (process CPU settles)", async () => {
    await runLimitedWorker("while (true) {}", {}, { ...LIMITS, timeoutMs: 300 })
    await sleep(300)
    const c0 = process.cpuUsage(); await sleep(400); const c1 = process.cpuUsage(c0)
    assert.ok((c1.user + c1.system) / 1000 < 150, `cpu ${(c1.user + c1.system) / 1000}ms in 400ms idle window`)
  })
  await test("HEAP: a JS heap bomb dies inside the worker; the host process survives", async () => {
    const r = await runLimitedWorker("const a = []; while (true) a.push(new Array(1e6).fill('x'.repeat(10)))", {}, { ...LIMITS, timeoutMs: 8000 })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.reason === "memory", `reason ${r.reason}`)
    assert.ok(process.memoryUsage().heapUsed < heapBefore + 150 * 1024 * 1024, "host heap unaffected")
  })
  await test("OFF-HEAP: an ArrayBuffer bomb (invisible to V8 heap limits) is caught by the watcher", async () => {
    const r = await runLimitedWorker("const keep = []; setInterval(() => keep.push(new Uint8Array(8*1024*1024).fill(1)), 5)", {}, { ...LIMITS, timeoutMs: 6000 })
    assert.deepEqual(r, { ok: false, reason: "memory" })
  })
  await test("OFF-HEAP (older Node without worker.getHeapStatistics): process-wide RSS growth still stops the bomb", async () => {
    const r = await runLimitedWorker("const keep = []; setInterval(() => keep.push(new Uint8Array(8*1024*1024).fill(1)), 5)", {}, { ...LIMITS, timeoutMs: 6000, forceCoarseMemoryWatch: true })
    assert.deepEqual(r, { ok: false, reason: "memory" })
  })
  await test("response is not held up by thread teardown (resolves right at the deadline)", async () => {
    const t0 = Date.now()
    await runLimitedWorker("while (true) {}", {}, { ...LIMITS, timeoutMs: 400 })
    assert.ok(Date.now() - t0 < 900)
  })
  await test("the worker has NO access to the host's secrets (empty process.env)", async () => {
    process.env.SYNTHETIC_SECRET_FOR_TEST = "should-not-leak"
    const r = await runLimitedWorker(
      "require('node:worker_threads').parentPort.postMessage({ ok: true, leaked: process.env.SYNTHETIC_SECRET_FOR_TEST ?? null, n: Object.keys(process.env).length })",
      {}, LIMITS)
    delete process.env.SYNTHETIC_SECRET_FOR_TEST
    assert.ok(r.ok && (r.value as { leaked: unknown; n: number }).leaked === null)
  })
  await test("a worker that throws / exits is a clean failure, not a crash", async () => {
    assert.equal((await runLimitedWorker("throw new Error('x')", {}, LIMITS)).ok, false)
    assert.equal((await runLimitedWorker("process.exit(0)", {}, LIMITS)).ok, false)
  })

  // ── PDF-specific protections ──
  await test("valid PDF parses; pdf.js eval is disabled in the worker", async () => {
    const r = await parsePdfIsolated(buildPdf(1))
    assert.ok(r.ok, JSON.stringify(r))
    if (r.ok) { assert.ok(r.text.includes(MARKER)); assert.equal(r.evalDisabled, true); assert.equal(r.numPages, 1) }
  })
  await test("input buffer is not consumed or modified by parsing", async () => {
    const b = buildPdf(1); const copy = Buffer.from(b)
    await parsePdfIsolated(b)
    assert.ok(b.equals(copy))
  })
  await test("PAGES: over the page limit is rejected BEFORE any text extraction", async () => {
    const r = await parsePdfIsolated(buildPdf(PDF_MAX_PAGES + 1))
    assert.deepEqual(r, { ok: false, reason: "too-many-pages" })
  })
  await test("DECOMPRESSION: a PDF with a flate bomb stream is refused (tiny file, huge expansion)", async () => {
    const bomb = flateObject(Buffer.alloc(64 * 1024 * 1024, 0)) // ~64 KB compressed → 64 MB
    const pdf = buildPdf(1, RESUME_TEXT, [bomb])
    assert.ok(pdf.length < 200 * 1024, `file is only ${pdf.length} bytes`)
    assert.deepEqual(await parsePdfIsolated(pdf), { ok: false, reason: "too-large" })
  })
  await test("DECOMPRESSION: many medium streams that add up past the TOTAL cap are refused", async () => {
    const streams = Array.from({ length: 6 }, () => flateObject(Buffer.alloc(12 * 1024 * 1024, 0)))
    const r = await parsePdfIsolated(buildPdf(1, RESUME_TEXT, streams), { perStreamMax: 16 * 1024 * 1024, totalMax: 48 * 1024 * 1024 })
    assert.deepEqual(r, { ok: false, reason: "too-large" })
  })
  await test("DECOMPRESSION: ordinary small flate streams are fine", async () => {
    const r = await parsePdfIsolated(buildPdf(1, RESUME_TEXT, [flateObject(Buffer.from("q 1 0 0 1 0 0 cm Q"))]))
    assert.ok(r.ok, JSON.stringify(r))
  })
  const a85enc = (b: Buffer) => {
    let out = "<~"
    for (let i = 0; i < b.length; i += 4) {
      const chunk = b.subarray(i, i + 4); const n = chunk.length
      let v = 0; for (let k = 0; k < 4; k++) v = v * 256 + (chunk[k] ?? 0)
      if (n === 4 && v === 0) { out += "z"; continue }
      const d: string[] = []; for (let k = 0; k < 5; k++) { d.unshift(String.fromCharCode((v % 85) + 33)); v = Math.floor(v / 85) }
      out += d.slice(0, n + 1).join("")
    }
    return Buffer.from(out + "~>", "latin1")
  }
  const a85FlateObject = (raw: Buffer) => {
    const enc = a85enc(zlib.deflateSync(raw))
    return Buffer.concat([Buffer.from(`<< /Length ${enc.length} /Filter [/ASCII85Decode /FlateDecode] >>\nstream\n`, "latin1"), enc, Buffer.from("\nendstream", "latin1")])
  }
  await test("DECOMPRESSION: ASCII85+Flate (e.g. reportlab output) is supported and bounded", async () => {
    const ok = await parsePdfIsolated(buildPdf(1, RESUME_TEXT, [a85FlateObject(Buffer.from("q 1 0 0 1 0 0 cm Q ".repeat(50)))]))
    assert.ok(ok.ok, JSON.stringify(ok))
    const bomb = await parsePdfIsolated(buildPdf(1, RESUME_TEXT, [a85FlateObject(Buffer.alloc(64 * 1024 * 1024))]))
    assert.deepEqual(bomb, { ok: false, reason: "too-large" })
  })
  await test("DECOMPRESSION: legacy filters that bypass the scan (LZW / RunLength) are refused", async () => {
    for (const f of ["LZWDecode", "RunLengthDecode"]) {
      const obj = Buffer.from(`<< /Length 4 /Filter /${f} >>\nstream\nabcd\nendstream`, "latin1")
      assert.deepEqual(await parsePdfIsolated(buildPdf(1, RESUME_TEXT, [obj])), { ok: false, reason: "unsupported-compression" }, f)
    }
  })
  await test("TEXT: extracted text is capped (no unbounded string growth)", async () => {
    const big = ("lorem ipsum dolor sit amet " ).repeat(40)
    const r = await parsePdfIsolated(buildPdf(10, big), { maxChars: 2000 })
    assert.ok(r.ok && r.text.length <= 2000 && r.truncated === true, JSON.stringify(r.ok ? { len: r.text.length } : r))
    assert.ok(PDF_MAX_TEXT_CHARS <= 250_000)
  })
  await test("CONCURRENCY: parses beyond the cap get 'busy' immediately instead of piling up", async () => {
    const pdf = buildPdf(1)
    const rs = await Promise.all(Array.from({ length: PDF_MAX_CONCURRENT + 3 }, () => parsePdfIsolated(pdf)))
    assert.equal(rs.filter(r => r.ok).length, PDF_MAX_CONCURRENT)
    assert.equal(rs.filter(r => !r.ok && r.reason === "busy").length, 3)
    // and the slots are released afterwards
    assert.ok((await parsePdfIsolated(pdf)).ok)
  })
  await test("a hostile PDF cannot hold a concurrency slot past the timeout", async () => {
    // slots are released in `finally` even on failure
    const bomb = buildPdf(1, RESUME_TEXT, [flateObject(Buffer.alloc(64 * 1024 * 1024))])
    await Promise.all([parsePdfIsolated(bomb), parsePdfIsolated(bomb)])
    assert.ok((await parsePdfIsolated(buildPdf(1))).ok, "slots were released")
  })
  await test("KILL-SWITCH: PDF_PARSING_ENABLED=false refuses PDFs; DOCX/TXT paths are unaffected", async () => {
    const saved = process.env.PDF_PARSING_ENABLED
    try {
      process.env.PDF_PARSING_ENABLED = "false"
      assert.equal(pdfParsingEnabled(), false)
      assert.deepEqual(await parsePdfIsolated(buildPdf(1)), { ok: false, reason: "disabled" })
      const r = await extractResumeText(buildPdf(1), "pdf")
      assert.equal(r.text, ""); assert.equal(r.code, "unavailable")
      const t = await extractResumeText(Buffer.from(RESUME_TEXT), "txt")
      assert.ok(t.text.includes(MARKER))
    } finally { if (saved === undefined) delete process.env.PDF_PARSING_ENABLED; else process.env.PDF_PARSING_ENABLED = saved }
  })
  await test("generic failure messages: nothing from the parser or file leaks to callers", async () => {
    for (const bytes of [Buffer.from("%PDF-1.4\nnot really\n"), buildPdf(PDF_MAX_PAGES + 1), buildPdf(1, RESUME_TEXT, [flateObject(Buffer.alloc(64 * 1024 * 1024))])]) {
      const r = await extractResumeText(bytes, "pdf")
      assert.ok(!/node_modules|webpack|\.js:|Error:|at /.test(r.warning ?? ""), r.warning)
      assert.ok(!(r.warning ?? "").includes(MARKER))
    }
  })
  // ── Pre-scan evasion: the scan is best-effort (NOT a complete PDF security boundary). The worker's
  // allocation guard is what must stop a bomb however its filter is spelled. A bomb must NEVER parse OK.
  const BOMB_BYTES = 40 * 1024 * 1024 // > 32 MB of output forces a >48 MB inflate buffer
  const bombDeflate = zlib.deflateSync(Buffer.alloc(BOMB_BYTES), { level: 9 })
  /** One-page PDF whose content stream is `stream`, with `dictExtra` in the stream dictionary and `extraObjs` appended. */
  function streamPdf(dictExtra: string, stream: Buffer, extraObjs: string[] = []): Buffer {
    const objs: Buffer[] = [
      Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
      Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
      Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>"),
      Buffer.concat([Buffer.from(`<< /Length ${stream.length} ${dictExtra} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream")]),
      ...extraObjs.map(o => Buffer.from(o, "latin1")),
    ]
    let out = Buffer.from("%PDF-1.4\n")
    const offs: number[] = []
    objs.forEach((o, i) => { offs.push(out.length); out = Buffer.concat([out, Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]) })
    const xref = out.length
    const table = ["0000000000 65535 f ", ...offs.map(o => `${String(o).padStart(10, "0")} 00000 n `)].map(l => l + "\n").join("")
    return Buffer.concat([out, Buffer.from(`xref\n0 ${objs.length + 1}\n${table}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)])
  }
  const adler = Buffer.alloc(4)
  const evasions: [string, Buffer][] = [
    ["plain /FlateDecode (caught by the pre-scan)", streamPdf("/Filter /FlateDecode", bombDeflate)],
    ["escaped filter name /Flat#65Decode", streamPdf("/Filter /Flat#65Decode", bombDeflate)],
    ["indirect filter reference /Filter 5 0 R", streamPdf("/Filter 5 0 R", bombDeflate, ["/FlateDecode"])],
    ["filter array [/ASCIIHexDecode /FlateDecode]", streamPdf("/Filter [/ASCIIHexDecode /FlateDecode]", Buffer.from(bombDeflate.toString("hex") + ">"))],
    ["filter array with #-escaped name [/ASCIIHexDecode /Flat#65Decode]", streamPdf("/Filter [/ASCIIHexDecode /Flat#65Decode]", Buffer.from(bombDeflate.toString("hex") + ">"))],
    ["literal 'endstream' bytes planted inside the data (truncates the scan's view)", (() => {
      const stored = Buffer.concat([Buffer.from([0x00, 9, 0, 0xf6, 0xff]), Buffer.from("endstream")]) // non-final stored block
      const raw = zlib.deflateRawSync(Buffer.alloc(BOMB_BYTES), { level: 9 })
      return streamPdf("/Filter /FlateDecode", Buffer.concat([Buffer.from([0x78, 0x9c]), stored, raw, adler]))
    })()],
  ]
  for (const [name, pdf] of evasions) {
    await test(`BOMB never parses OK: ${name}`, async () => {
      const t0 = Date.now()
      const r = await parsePdfIsolated(new Uint8Array(pdf))
      assert.equal(r.ok, false, "a decompression bomb must never return a successful parse")
      assert.ok(Date.now() - t0 < 6000, "and must fail promptly")
      // The generic entry point returns no text and no machine code for it either.
      const g = await extractResumeText(pdf, "pdf")
      assert.equal(g.text, "")
      assert.ok(g.warning)
    })
  }
  await test("the allocation guard (not only the pre-scan) is what stops evasions: reason is too-large", async () => {
    for (const [name, pdf] of evasions.slice(2, 4)) {
      const r = await parsePdfIsolated(new Uint8Array(pdf))
      assert.deepEqual(r, { ok: false, reason: "too-large" }, name)
    }
  })
  await test("allocation guard keeps legitimate PDFs working (text, multi-page, many objects)", async () => {
    const r = await parsePdfIsolated(new Uint8Array(buildPdf(5)))
    assert.ok(r.ok && r.text.includes(MARKER))
  })

  await test("host memory did not balloon across all hostile cases", async () => {
    await sleep(500)
    if (global.gc) global.gc()
    assert.ok(process.memoryUsage().rss < rssBefore + 600 * 1024 * 1024, `rss grew ${(process.memoryUsage().rss - rssBefore) / 1048576 | 0} MB`)
  })

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed ? 1 : 0)
}
main()
