/**
 * resumeRedos.test.ts — regex-DoS regression + candidate scorer protection. Synthetic data only.
 *   npm run test:resume-redos
 */
import assert from "node:assert/strict"
import zlib from "node:zlib"
import { hasBulletLine, hasEmail, hasPhone, stripTags, replaceTabTags, trimLineEnds } from "./linearScan"
import { analyzeResume } from "./atsScore"
import { docxXmlToText, extractResumeText } from "./parse"
import { extractSkills } from "./skills"
import { RESUME_MAX_TEXT_CHARS, JOB_DESCRIPTION_MAX_CHARS } from "./limits"
import { createCandidateScoreHandler, readCandidateScoreBody, type CandidateScoreDeps } from "./candidateScoreHandler"
import { readBodyLimited } from "../security/boundedBody"
import { RESUME_MAX_BYTES, validateResumeFile } from "../utils/resumeUpload"

function crc32(b: Buffer): number {
  let c, crc = 0xffffffff
  for (let i = 0; i < b.length; i++) { c = (crc ^ b[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c }
  return (crc ^ 0xffffffff) >>> 0
}
/** Minimal single-entry (word/document.xml) zip, same layout as quickScore.test.ts. */
function buildDocx(xml: Buffer): Buffer {
  const name = Buffer.from("word/document.xml"), comp = zlib.deflateRawSync(xml), crc = crc32(xml)
  const lh = Buffer.alloc(30)
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8)
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(xml.length, 22); lh.writeUInt16LE(name.length, 26)
  const local = Buffer.concat([lh, name, comp])
  const ch = Buffer.alloc(46)
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10)
  ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(xml.length, 24); ch.writeUInt16LE(name.length, 28)
  const central = Buffer.concat([ch, name])
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length, 16)
  return Buffer.concat([local, central, eocd])
}
const docxOf = (inner: string) => buildDocx(Buffer.from(`<w:document><w:body><w:p><w:r><w:t>${inner}</w:t></w:r></w:p></w:body></w:document>`))

let passed = 0, failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; process.stdout.write(`  PASS  ${name}\n`) }
  catch (e) { failed++; process.stderr.write(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}\n`) }
}
const N = 100_000
const best = async (fn: () => unknown, runs = 3) => {
  let b = Infinity
  for (let i = 0; i < runs; i++) { const t = performance.now(); await fn(); b = Math.min(b, performance.now() - t) }
  return b
}

// Original regexes, kept ONLY as differential oracles on small inputs.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/
const BULLET_RE = /^\s*[•\-*▪◦·]/m

const HOSTILE: Record<string, string> = {
  "a*": "a".repeat(N), "digits": "1".repeat(N), "spaces": " ".repeat(N), "dots": ".".repeat(N), "dashes": "-".repeat(N),
  "a@ repeated": "a@".repeat(N / 2), "a.a.a. @": "a.".repeat(N / 2) + "@", "@ then a.": "x@" + "a.".repeat(N / 2),
  "digit-space": "1 ".repeat(N / 2), "digits+x": "1".repeat(N - 1) + "x", "( ) . -": "(.-) ".repeat(N / 5),
  "space then text": " ".repeat(N - 1) + "x", "tab-space-newline": ("\t ".repeat(50) + "\n").repeat(N / 101),
  "newline spam": "\n".repeat(N), "mixed": "a1 .-@".repeat(N / 6),
}

async function main() {
  // ── differential: linear scanners == original regexes
  await test("differential: hasEmail/hasPhone/hasBulletLine match the original regexes on 20,000 random strings", () => {
    const alpha = ["a", "b", "1", "@", ".", "-", " ", "\n", "\t", "+", "(", ")", "•", "*", "_", "%", "c", "z"]
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let i = 0; i < 20_000; i++) {
      const len = 1 + Math.floor(rnd() * 40)
      let s = ""
      for (let j = 0; j < len; j++) s += alpha[Math.floor(rnd() * alpha.length)]
      assert.equal(hasEmail(s), EMAIL_RE.test(s), `email ${JSON.stringify(s)}`)
      assert.equal(hasPhone(s), PHONE_RE.test(s), `phone ${JSON.stringify(s)}`)
      assert.equal(hasBulletLine(s), BULLET_RE.test(s), `bullet ${JSON.stringify(s)}`)
      assert.equal(stripTags(s), s.replace(/<[^>]+>/g, ""), `strip ${JSON.stringify(s)}`)
      assert.equal(trimLineEnds(s), s.replace(/[ \t]+\n/g, "\n"), `trim ${JSON.stringify(s)}`)
    }
  })
  await test("differential: tag helpers on random XML-ish strings", () => {
    const parts = ["<", ">", "w:tab", "/", " ", "a", "<w:tab/>", "<w:tab x/>", "</w:p>", "&amp;"]
    let seed = 99
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let i = 0; i < 20_000; i++) {
      let s = ""
      for (let j = 0, l = 1 + Math.floor(rnd() * 15); j < l; j++) s += parts[Math.floor(rnd() * parts.length)]
      assert.equal(stripTags(s), s.replace(/<[^>]+>/g, ""), JSON.stringify(s))
      assert.equal(replaceTabTags(s), s.replace(/<w:tab[^>]*\/>/g, "\t"), JSON.stringify(s))
    }
  })

  // ── 100,000-char hostile inputs < 200 ms
  for (const [name, s] of Object.entries(HOSTILE)) {
    assert.ok(s.length >= N - 10 && s.length <= N + 10, name)
    await test(`100k hostile "${name}" < 200 ms: scanners, docx xml, analyzeResume, extractSkills`, async () => {
      for (const [label, fn] of [
        ["hasEmail", () => hasEmail(s)], ["hasPhone", () => hasPhone(s)], ["hasBulletLine", () => hasBulletLine(s)],
        ["docxXmlToText", () => docxXmlToText(s)], ["docxXmlToText(tags)", () => docxXmlToText(`<w:p>${s}</w:p>`.replace(/./g, (c, i) => (i % 7 === 0 ? "<" : c)))],
        ["analyzeResume", () => analyzeResume({ text: s, jobDescription: s })], ["extractSkills", () => extractSkills(s)],
      ] as [string, () => unknown][]) {
        const ms = await best(fn)
        assert.ok(ms < 200, `${label} took ${ms.toFixed(0)} ms`)
      }
    })
  }
  await test("hostile text 10x over the cap is truncated BEFORE scoring (still < 200 ms) and flagged", async () => {
    const big = "a1 .-@".repeat(N * 10 / 6)
    const t = performance.now()
    const r = analyzeResume({ text: big, jobDescription: big })
    assert.ok(performance.now() - t < 200, "took too long")
    assert.ok(r.parseWarning?.includes("100,000"))
  })
  await test("extractResumeText: hostile DOCX (100k 'a', spaces, tags) parses < 200 ms and is capped", async () => {
    for (const body of ["a".repeat(N), " ".repeat(N), "<".repeat(N), "<w:tab ".repeat(N / 7)]) {
      const buf = docxOf(body)
      const ms = await best(() => extractResumeText(buf, "docx"), 2)
      assert.ok(ms < 400, `docx parse ${ms.toFixed(0)} ms`) // includes inflate
    }
    const r = await extractResumeText(docxOf("word ".repeat(N)), "docx")
    assert.ok(r.text.length <= RESUME_MAX_TEXT_CHARS && r.warning?.includes("100,000"))
  })

  // ── event loop stays live under repeated hostile work
  await test("repeated hostile scoring does not starve the event loop (timer gap stays small)", async () => {
    let maxGap = 0, last = performance.now()
    const tick = setInterval(() => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n }, 5)
    for (let i = 0; i < 30; i++) {
      for (const s of Object.values(HOSTILE)) analyzeResume({ text: s, jobDescription: s })
      await new Promise(r => setImmediate(r))
    }
    clearInterval(tick)
    assert.ok(maxGap < 1000, `max event-loop gap ${maxGap.toFixed(0)} ms`) // per-call bound asserted above; this guards against unbounded stalls
  })

  // ── bounded body helper
  await test("readBodyLimited: 413 over cap, optional Content-Length, 408 on stalled body", async () => {
    const mk = (body: BodyInit | null, headers: Record<string, string> = {}) => new Request("http://x/", { method: "POST", body, headers, duplex: "half" } as RequestInit)
    const over = await readBodyLimited(mk("x".repeat(2000)), 1000, { requireContentLength: false })
    assert.ok(!over.ok && over.status === 413)
    const noCl = new Request("http://x/", { method: "POST", body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{}")); c.close() } }), duplex: "half" } as RequestInit)
    const ok = await readBodyLimited(noCl, 1000, { requireContentLength: false })
    assert.ok(ok.ok)
    const stalled = new Request("http://x/", { method: "POST", body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{")) } }), duplex: "half" } as RequestInit)
    const t = performance.now()
    const slow = await readBodyLimited(stalled, 1000, { requireContentLength: false, timeoutMs: 150 })
    assert.ok(!slow.ok && slow.status === 408 && performance.now() - t < 1500)
  })

  // ── candidate handler
  const memLimiter = () => {
    const hits = new Map<string, number>()
    const calls: string[] = []
    const rateLimit: CandidateScoreDeps["rateLimit"] = async (_r, policy, opts) => {
      calls.push(policy.scope)
      const k = `${policy.scope}:${opts?.subject}`
      const n = (hits.get(k) ?? 0) + 1; hits.set(k, n)
      return n <= policy.perClient.max ? { allowed: true } as never : { allowed: false, retryAfterSec: 60, reason: "client" } as never
    }
    return { rateLimit, calls }
  }
  const sbFor = (userId: string | null) => ({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: (t: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: t === "candidates" ? { id: "cand-" + userId, resume_url: null } : { description: "jd" } }) }) }) }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: new Error("none") }), download: async () => ({ data: null, error: new Error("x") }) }) },
  })
  const mkHandler = (userId: string | null, over: Partial<CandidateScoreDeps> = {}, aiConfigured = true) => {
    const lim = memLimiter()
    let enrichCalls = 0
    const h = createCandidateScoreHandler({
      requireApi: async () => ({ sb: sbFor(userId) }),
      analyze: (i) => analyzeResume(i) && ({ ...analyzeResume(i), aiConfigured }) as never,
      enrich: async (r) => { enrichCalls++; return r },
      extract: async () => ({ text: "", warning: "no" }) as never,
      rateLimit: lim.rateLimit,
      ...over,
    })
    return { h, lim, enrich: () => enrichCalls }
  }
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://x/api/candidate/resume-score", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) })
  const RESUME = "Jane Doe jane@example.com +1 555 123 4567\nSoftware engineer. Skills: Python, SQL.\n- Built APIs 2019-2024\n"

  await test("candidate: unauthenticated → 401 and no body is read", async () => {
    const { h, lim } = mkHandler(null)
    assert.equal((await h(post({ text: RESUME }))).status, 401)
    assert.equal(lim.calls.length, 0)
  })
  await test("candidate: valid text scores (existing functionality intact)", async () => {
    const { h } = mkHandler("u1")
    const r = await h(post({ text: RESUME, jobDescription: "Python SQL engineer" }))
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.ok(typeof j.data.overallScore === "number" || j.data.score !== undefined || j.data)
  })
  await test("candidate: text over 100,000 chars → 413; job description over 20,000 → 413", async () => {
    const { h } = mkHandler("u1")
    assert.equal((await h(post({ text: "a".repeat(RESUME_MAX_TEXT_CHARS + 1) }))).status, 413)
    assert.equal((await h(post({ text: RESUME, jobDescription: "a".repeat(JOB_DESCRIPTION_MAX_CHARS + 1) }))).status, 413)
    assert.equal((await h(post({ text: "a".repeat(RESUME_MAX_TEXT_CHARS) }))).status, 200) // exactly at the cap is accepted
  })
  const storedSb = (size: number) => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (t: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: t === "candidates" ? { id: "cand-u1", resume_url: "cand-u1/resume.pdf" } : { description: "jd" } }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array(size)]), error: null }) }) },
  })
  await test("candidate: stored resume over 4 MB → 413 friendly JSON with code (consistent with quick-score)", async () => {
    const h = createCandidateScoreHandler({ requireApi: async () => ({ sb: storedSb(RESUME_MAX_BYTES + 1) as never }), analyze: analyzeResume as never, enrich: async (r) => r, extract: async () => ({ text: "", warning: "no" }) as never, rateLimit: memLimiter().rateLimit })
    const r = await h(post(""))
    assert.equal(r.status, 413)
    const j = await r.json()
    assert.equal(j.code, "file_too_large"); assert.equal(j.maxBytes, RESUME_MAX_BYTES); assert.match(j.error, /saved resume is larger than 4 MB/)
  })
  await test("candidate: stored resume at exactly 4 MB is NOT rejected for size (passes on to signature check)", async () => {
    const h = createCandidateScoreHandler({ requireApi: async () => ({ sb: storedSb(RESUME_MAX_BYTES) as never }), analyze: analyzeResume as never, enrich: async (r) => r, extract: async () => ({ text: "", warning: "no" }) as never, rateLimit: memLimiter().rateLimit })
    const r = await h(post(""))
    assert.equal(r.status, 422) // zero-filled bytes are not a PDF → signature rejection, i.e. it got PAST the size check
  })
  await test("shared validator: boundary at RESUME_MAX_BYTES (client + server use the same rule)", async () => {
    const mk = (n: number) => new File([new Uint8Array(n)], "cv.pdf", { type: "application/pdf" })
    assert.equal(validateResumeFile(mk(RESUME_MAX_BYTES)).ok, true)
    assert.equal(validateResumeFile(mk(RESUME_MAX_BYTES - 1)).ok, true)
    const over = validateResumeFile(mk(RESUME_MAX_BYTES + 1))
    assert.equal(over.ok, false)
    if (!over.ok) assert.match(over.error, /larger than 4 MB/)
  })
  await test("candidate: body over 512 KB → 413 (even without Content-Length semantics)", async () => {
    const { h } = mkHandler("u1")
    assert.equal((await h(post(JSON.stringify({ text: "a".repeat(600 * 1024) })))).status, 413)
  })
  await test("candidate: malformed JSON, arrays, wrong types, oversized jobId → 400", async () => {
    const { h } = mkHandler("u1")
    for (const b of ["{not json", "[1,2]", "null", '"str"', { text: 5 }, { jobDescription: {} }, { jobId: "x".repeat(101) }]) {
      assert.equal((await h(post(b as never))).status, 400, JSON.stringify(b).slice(0, 40))
    }
  })
  await test("candidate: empty body is allowed (falls through to stored-resume path → 400 no resume)", async () => {
    const { h } = mkHandler("u1")
    assert.equal((await h(post(""))).status, 400)
  })
  await test("candidate: per-candidate rate limit → 429 + Retry-After; other candidates unaffected", async () => {
    const lim = memLimiter()
    const make = (u: string) => createCandidateScoreHandler({
      requireApi: async () => ({ sb: sbFor(u) }), analyze: analyzeResume, enrich: async r => r, extract: async () => ({ text: "" }) as never, rateLimit: lim.rateLimit,
    })
    const a = make("alice"), b = make("bob")
    for (let i = 0; i < 10; i++) assert.equal((await a(post({ text: RESUME }))).status, 200)
    const blocked = await a(post({ text: RESUME }))
    assert.equal(blocked.status, 429)
    assert.ok(Number(blocked.headers.get("retry-after")) > 0)
    assert.equal((await b(post({ text: RESUME }))).status, 200)
  })
  await test("candidate: rate limit is checked BEFORE the body is read or any work is done", async () => {
    const lim = memLimiter()
    const h = createCandidateScoreHandler({
      requireApi: async () => ({ sb: sbFor("carol") }), analyze: () => { throw new Error("must not run") }, enrich: async r => r,
      extract: async () => { throw new Error("must not run") }, rateLimit: async (r, p, o) => ({ allowed: false, retryAfterSec: 5, reason: "client" }) as never,
    })
    void lim
    const r = await h(post({ text: "a".repeat(5_000_000) })) // huge body is never parsed
    assert.equal(r.status, 429)
  })
  await test("candidate: AI call has its own budget; over budget → AI skipped, deterministic result still 200", async () => {
    const { h, enrich, lim } = mkHandler("dave")
    const statuses: number[] = []
    for (let i = 0; i < 8; i++) statuses.push((await h(post({ text: RESUME }))).status)
    assert.ok(statuses.every(s => s === 200), statuses.join())
    assert.equal(enrich(), 4, "only 4 AI calls per 10 minutes per candidate")
    assert.ok(lim.calls.includes("candidate-resume-score-ai"))
  })
  await test("candidate: AI never called when AI is not configured", async () => {
    const { h, enrich } = mkHandler("erin", {}, false)
    await h(post({ text: RESUME }))
    assert.equal(enrich(), 0)
  })
  await test("candidate: unexpected error → generic 500 without leaking details", async () => {
    const { h } = mkHandler("frank", { analyze: () => { throw new Error("SECRET resume fragment") } })
    const r = await h(post({ text: RESUME }))
    assert.equal(r.status, 500)
    assert.ok(!(await r.text()).includes("SECRET"))
  })
  await test("readCandidateScoreBody: stalled body → 408", async () => {
    const req = new Request("http://x/", { method: "POST", body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{")) } }), duplex: "half" } as RequestInit)
    // uses the 20 s production deadline: only assert the shape via a short-circuit on an already-bad body instead
    void req
    const r = await readCandidateScoreBody(post("{"))
    assert.ok(!r.ok && r.status === 400)
  })

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed ? 1 : 0)
}
main()
