/**
 * pdfIsolated.ts — run pdf.js for PUBLIC resume uploads in a separate worker THREAD with
 * resource limits that are actually enforced, instead of a Promise.race that only stops waiting.
 *
 * WHAT IS ENFORCED
 *  - CPU/time: the worker is TERMINATED (worker.terminate(), which interrupts running JS even in a
 *    tight loop) after PDF_PARSE_TIMEOUT_MS. The response never waits for the thread to finish dying.
 *  - JS heap: V8 `resourceLimits` (maxOldGenerationSizeMb) — an out-of-memory in the worker kills only
 *    the worker; the web process keeps serving.
 *  - Off-heap memory (ArrayBuffers/typed arrays, where inflated PDF data lives): resourceLimits does
 *    NOT cover these, so the parent polls the worker's heap statistics (external + heap bytes) and
 *    terminates it past PDF_MAX_WORKER_BYTES. That needs `worker.getHeapStatistics()` (Node >= 22.16 /
 *    24). On older runtimes (hostinger.json pins Node 20!) it falls back to growth of the whole
 *    process' RSS since the parse started — coarser: unrelated concurrent allocations count too, so a
 *    legitimate parse during a large unrelated memory spike could be refused (fails safe). NOTE:
 *    `process.memoryUsage().arrayBuffers` does NOT see a worker's buffers and cannot be used.
 *  - Decompression pre-scan: before pdf.js sees the file, every plain /FlateDecode stream is inflated
 *    with zlib `maxOutputLength` (per-stream and total caps) — ASCII85+Flate chains (e.g. reportlab)
 *    are ASCII85-decoded first — and files using LZW / RunLength filters are rejected. This is a HEURISTIC scanner: a crafted file that hides a stream
 *    from the scan is only stopped by the time and memory limits above.
 *  - Output: page count checked BEFORE any text extraction (PDF_MAX_PAGES), extracted text capped at
 *    PDF_MAX_TEXT_CHARS, input already capped by the upload size limit.
 *  - Concurrency: at most PDF_MAX_CONCURRENT parses at once; extra requests get `busy` (HTTP 503).
 *  - pdf.js hardening: `isEvalSupported = false` (pdf.js 1.10 compiles glyphs with `new Function`
 *    by default — the mechanism behind CVE-2024-4367, fixed upstream only in 4.2.67), fonts are not
 *    instantiated, and the worker gets an EMPTY environment (no access to secrets in process.env).
 *
 * WHAT IS NOT PROVIDED (do not read this as a sandbox)
 *  - A worker thread shares the process with the app: it is NOT a security boundary against code
 *    execution (it can still reach the filesystem/network). Real containment needs a separate
 *    unprivileged process/container, which this deployment (single Node process, ₹0) does not offer.
 *  - Memory from a stream the pre-scan cannot see can grow until the poll (≈50 ms) or timeout fires.
 *  - If the platform cannot start worker threads, parsing FAILS CLOSED ("unavailable").
 *  If that residual risk is unacceptable, public PDF parsing should be switched off
 *  (see PDF_PARSING_ENABLED) and DOCX/TXT/DOC offered instead.
 */
import { Worker } from "node:worker_threads"
import fs from "node:fs"
import path from "node:path"

export const PDF_MAX_PAGES = 15
export const PDF_PARSE_TIMEOUT_MS = 8_000
export const PDF_MAX_TEXT_CHARS = 200_000
export const PDF_MAX_CONCURRENT = 2
export const PDF_WORKER_HEAP_MB = 128
export const PDF_MAX_WORKER_BYTES = 256 * 1024 * 1024
export const PDF_FLATE_STREAM_MAX = 16 * 1024 * 1024
export const PDF_ALLOC_MAX = 48 * 1024 * 1024 // single typed-array allocation inside the worker (see installAllocationGuard)
export const PDF_FLATE_TOTAL_MAX = 48 * 1024 * 1024
const POLL_MS = 50
const TERMINATE_WAIT_MS = 0 // never block the response on thread teardown

/** Kill-switch: set PDF_PARSING_ENABLED=false to refuse all PDF parsing (DOCX/DOC/TXT unaffected). */
export function pdfParsingEnabled(): boolean {
  return (process.env.PDF_PARSING_ENABLED ?? "true").toLowerCase() !== "false"
}

export type PdfFailure =
  | "too-many-pages" | "timeout" | "memory" | "too-large"
  | "unsupported-compression" | "unreadable" | "unavailable" | "busy" | "disabled"
export type PdfResult =
  | { ok: true; text: string; numPages: number; evalDisabled: boolean; truncated: boolean }
  | { ok: false; reason: PdfFailure }

export interface WorkerLimits {
  timeoutMs: number
  heapMb: number
  maxWorkerBytes: number
  /** Test seam: behave as on runtimes without worker.getHeapStatistics() (Node < 22.16). */
  forceCoarseMemoryWatch?: boolean
}

/** Worker body (CommonJS, evaluated in the worker). No template substitutions inside. */
export const PDF_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require("node:worker_threads")
const zlib = require("node:zlib")
const d = workerData
const buf = Buffer.from(d.bytes.buffer, d.bytes.byteOffset, d.bytes.byteLength)
const done = (m) => parentPort.postMessage(m)

function a85(slice) {
  let s = slice.toString("latin1").replace(/\s+/g, "")
  if (s.startsWith("<~")) s = s.slice(2)
  const e = s.indexOf("~>")
  if (e >= 0) s = s.slice(0, e)
  const out = Buffer.alloc(s.length * 4 + 8)
  let o = 0, n = 0, v = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 122 && n === 0) { out.writeUInt32BE(0, o); o += 4; continue }
    if (c < 33 || c > 117) return null
    v = v * 85 + (c - 33); n++
    if (n === 5) { out.writeUInt32BE(v >>> 0, o); o += 4; v = 0; n = 0 }
  }
  if (n > 1) {
    for (let k = n; k < 5; k++) v = v * 85 + 84
    const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); b.copy(out, o, 0, n - 1); o += n - 1
  }
  return out.subarray(0, o)
}

function unescapeNames(t) {
  return t.indexOf("#") < 0 ? t : t.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

// Real bound on decompression, independent of the pre-scan (which is best-effort and can be evaded:
// indirect /Filter references, filter chains, stream-length tricks). pdf.js inflates into typed arrays
// that it grows by doubling; refusing any single allocation above allocMax stops a bomb wherever it hides.
// pdf.js may swallow the RangeError and carry on, so the flag is checked again before returning a result.
let guardState = { tripped: false }
function installAllocationGuard(maxBytes) {
  const names = ["ArrayBuffer", "Uint8Array", "Uint8ClampedArray", "Int8Array", "Uint16Array", "Int16Array", "Uint32Array", "Int32Array", "Float32Array", "Float64Array"]
  for (const name of names) {
    const Orig = globalThis[name]
    if (typeof Orig !== "function") continue
    const bpe = Orig.BYTES_PER_ELEMENT || 1
    globalThis[name] = new Proxy(Orig, {
      construct(target, args, newTarget) {
        const a = args[0]
        let n = 0
        if (typeof a === "number") n = a * bpe
        else if (a && typeof a === "object" && typeof a.length === "number") n = a.length * bpe
        if (n > maxBytes) { guardState.tripped = true; throw new RangeError("allocation limit") }
        return Reflect.construct(target, args, newTarget)
      },
    })
  }
}

function preflight() {
  const txt = buf.toString("latin1")
  if (/\/(LZWDecode|RunLengthDecode)\b/.test(txt)) return "unsupported-compression"
  const re = /stream(\r\n|\n|\r)/g
  let total = 0, m
  while ((m = re.exec(txt)) !== null) {
    if (txt.substr(m.index - 3, 3) === "end") continue
    const start = m.index + m[0].length
    let end = txt.indexOf("endstream", start)
    if (end < 0) end = txt.length
    re.lastIndex = end
    // PDF names may hide characters as #xx (e.g. /Flat#65Decode); decode them before matching.
    const dict = unescapeNames(txt.slice(Math.max(0, txt.lastIndexOf("obj", m.index)), m.index))
    if (/\/(LZWDecode|RunLengthDecode)\b/.test(dict)) return "unsupported-compression"
    if (!/\/FlateDecode\b|\/Fl\b/.test(dict)) continue
    try {
      let data = buf.subarray(start, end)
      if (/\/ASCII85Decode\b|\/A85\b/.test(dict)) { data = a85(data); if (!data) continue }
      const out = zlib.inflateSync(data, { maxOutputLength: d.perStreamMax, finishFlush: zlib.constants.Z_SYNC_FLUSH })
      total += out.length
      if (total > d.totalMax) return "too-large"
    } catch (e) {
      if (e && e.code === "ERR_BUFFER_TOO_LARGE") return "too-large"
      // malformed / truncated stream: leave it to pdf.js
    }
  }
  return null
}

async function run() {
  const bad = preflight()
  if (bad) return done({ ok: false, reason: bad })
  installAllocationGuard(d.allocMax)
  const PDFJS = require(d.pdfJsPath)
  PDFJS.disableWorker = true
  PDFJS.isEvalSupported = false
  PDFJS.disableFontFace = true
  const task = PDFJS.getDocument(new Uint8Array(buf))
  try {
    const doc = await task.promise
    if (doc.numPages > d.maxPages) return done({ ok: false, reason: "too-many-pages" })
    let text = "", truncated = false
    for (let i = 1; i <= doc.numPages && !truncated; i++) {
      let pageText = ""
      try {
        const page = await doc.getPage(i)
        const tc = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        let lastY
        for (const item of tc.items) {
          pageText += (lastY === item.transform[5] || !lastY) ? item.str : "\n" + item.str
          lastY = item.transform[5]
        }
      } catch (e) { pageText = "" }
      text = text + "\n\n" + pageText
      if (text.length > d.maxChars) { text = text.slice(0, d.maxChars); truncated = true }
    }
    if (guardState.tripped) return done({ ok: false, reason: "too-large" })
    return done({ ok: true, text, numPages: doc.numPages, evalDisabled: PDFJS.isEvalSupported === false, truncated })
  } finally {
    try { await task.destroy() } catch (e) { /* already torn down */ }
  }
}
run().catch(() => done({ ok: false, reason: guardState.tripped ? "too-large" : "unreadable" }))
`

let active = 0

/**
 * Locate pdf.js in the runtime node_modules (dev, standalone and ZIP deployments).
 * Plain path probing on purpose: webpack rewrites `createRequire(...)`/`require.resolve` in server
 * bundles and silently ignores their arguments, so those cannot be used here.
 */
export function resolvePdfJsPath(): string | null {
  const rel = path.join("node_modules", "pdf-parse", "lib", "pdf.js", "v1.10.100", "build", "pdf.js")
  const roots = [process.cwd(), process.argv[1] ? path.dirname(process.argv[1]) : ""].filter(Boolean)
  for (const r of roots) {
    const candidate = path.join(r, rel)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Run a worker script under the limits. Exported for tests (they pass hostile scripts to prove the
 * limits are real); production code uses parsePdfIsolated().
 */
export function runLimitedWorker(
  source: string,
  workerData: Record<string, unknown>,
  limits: WorkerLimits,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: PdfFailure }> {
  return new Promise(resolve => {
    let worker: Worker
    try {
      worker = new Worker(source, {
        eval: true,
        workerData,
        env: {}, // the parser never sees process.env secrets
        resourceLimits: { maxOldGenerationSizeMb: limits.heapMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      })
    } catch {
      return resolve({ ok: false, reason: "unavailable" })
    }
    let settled = false
    let polling = false
    const baseRss = process.memoryUsage.rss()
    const finish = (r: { ok: true; value: unknown } | { ok: false; reason: PdfFailure }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(poll)
      // Fire and forget: terminate() interrupts the thread, but we never wait for it.
      void Promise.race([worker.terminate(), new Promise(r2 => setTimeout(r2, TERMINATE_WAIT_MS))]).catch(() => {})
      resolve(r)
    }
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), limits.timeoutMs)
    const poll = setInterval(async () => {
      if (settled || polling) return
      polling = true
      try {
        const w = worker as unknown as { getHeapStatistics?: () => Promise<{ external_memory: number; used_heap_size: number }> }
        if (typeof w.getHeapStatistics === "function" && !limits.forceCoarseMemoryWatch) {
          const s = await w.getHeapStatistics()
          if (s.external_memory + s.used_heap_size > limits.maxWorkerBytes) finish({ ok: false, reason: "memory" })
        } else if (process.memoryUsage.rss() - baseRss > limits.maxWorkerBytes) {
          finish({ ok: false, reason: "memory" })
        }
      } catch { /* worker already gone */ } finally { polling = false }
    }, POLL_MS)
    worker.once("message", (m: { ok: boolean; reason?: PdfFailure } & Record<string, unknown>) =>
      finish(m && m.ok === false ? { ok: false, reason: m.reason ?? "unreadable" } : { ok: true, value: m }))
    worker.once("error", (e: Error & { code?: string }) =>
      finish({ ok: false, reason: e?.code === "ERR_WORKER_OUT_OF_MEMORY" ? "memory" : "unreadable" }))
    worker.once("exit", () => finish({ ok: false, reason: "unreadable" }))
  })
}

export async function parsePdfIsolated(
  bytes: Uint8Array,
  over: Partial<WorkerLimits> & { maxPages?: number; maxChars?: number; perStreamMax?: number; totalMax?: number } = {},
): Promise<PdfResult> {
  if (!pdfParsingEnabled()) return { ok: false, reason: "disabled" }
  const pdfJsPath = resolvePdfJsPath()
  if (!pdfJsPath) return { ok: false, reason: "unavailable" }
  if (active >= PDF_MAX_CONCURRENT) return { ok: false, reason: "busy" }
  active++
  try {
    const copy = new Uint8Array(bytes) // the worker gets its own copy; the caller's buffer is untouched
    const r = await runLimitedWorker(
      PDF_WORKER_SOURCE,
      {
        bytes: copy, pdfJsPath,
        maxPages: over.maxPages ?? PDF_MAX_PAGES,
        maxChars: over.maxChars ?? PDF_MAX_TEXT_CHARS,
        perStreamMax: over.perStreamMax ?? PDF_FLATE_STREAM_MAX,
        totalMax: over.totalMax ?? PDF_FLATE_TOTAL_MAX,
        allocMax: PDF_ALLOC_MAX,
      },
      {
        timeoutMs: over.timeoutMs ?? PDF_PARSE_TIMEOUT_MS,
        heapMb: over.heapMb ?? PDF_WORKER_HEAP_MB,
        maxWorkerBytes: over.maxWorkerBytes ?? PDF_MAX_WORKER_BYTES,
      },
    )
    if (!r.ok) return r
    const v = r.value as { text: string; numPages: number; evalDisabled: boolean; truncated: boolean }
    return { ok: true, text: v.text, numPages: v.numPages, evalDisabled: v.evalDisabled, truncated: v.truncated }
  } finally {
    active--
  }
}
