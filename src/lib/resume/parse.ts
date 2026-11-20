/**
 * resume/parse.ts — extract plain text from resume files (server-only).
 *
 *   • PDF  → pdf-parse (already a project dependency, used by ingestion).
 *   • DOCX → read word/document.xml from the OOXML zip via the central directory
 *            and inflate it with the built-in zlib (no extra dependency).
 *   • DOC (legacy binary) → best-effort ASCII scrape; may be partial.
 *   • TXT  → utf-8.
 *
 * Never throws: returns { text, warning? }. Real extraction — no fabrication.
 */
import zlib from "node:zlib"

/** Hard ceilings so a hostile upload cannot exhaust memory or CPU. */
export const DOCX_MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024 // word/document.xml after inflate
export const PDF_MAX_PAGES = 15
export const PDF_PARSE_TIMEOUT_MS = 10_000

class ResumeLimitError extends Error {}

export interface ParsedResume {
  text: string
  warning?: string
}

export type ResumeExt = "pdf" | "docx" | "doc" | "txt"

export function extToKind(ext: string): ResumeExt | null {
  const e = ext.toLowerCase().replace(/^\./, "")
  if (e === "pdf" || e === "docx" || e === "doc" || e === "txt") return e
  return null
}

/** Minimal surface of the bundled pdf.js 1.10 we drive directly (see parsePdf). */
interface PdfJsLib {
  disableWorker: boolean
  getDocument(src: Uint8Array): {
    promise: Promise<{
      numPages: number
      getPage(n: number): Promise<{ getTextContent(o: object): Promise<{ items: { str: string; transform: number[] }[] }> }>
    }>
    destroy(): Promise<void>
  }
}

async function parsePdf(buf: Buffer): Promise<ParsedResume> {
  let task: ReturnType<PdfJsLib["getDocument"]> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const mod = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js")
    const PDFJS = ((mod as { default?: unknown }).default ?? mod) as PdfJsLib
    PDFJS.disableWorker = true
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new ResumeLimitError("pdf-timeout")), PDF_PARSE_TIMEOUT_MS)
    })
    // We drive pdf.js ourselves (rather than through pdf-parse) so the loading task is ALWAYS
    // destroyed and awaited, success or failure. pdf-parse never destroys a failed task and does
    // not await doc.destroy(); with pdf.js's shared fake worker that left stale state that made the
    // next, perfectly valid, PDF intermittently fail with "bad XRef entry".
    const work = (async () => {
      task = PDFJS.getDocument(new Uint8Array(buf))
      const doc = await task.promise
      if (doc.numPages > PDF_MAX_PAGES) return { text: "", numPages: doc.numPages }
      let text = ""
      for (let i = 1; i <= doc.numPages; i++) {
        const pageText = await doc.getPage(i).then(async page => {
          const tc = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
          let lastY: number | undefined
          let t = ""
          for (const item of tc.items) {
            t += lastY === item.transform[5] || !lastY ? item.str : "\n" + item.str
            lastY = item.transform[5]
          }
          return t
        }).catch(() => "")
        text = `${text}\n\n${pageText}`
      }
      return { text, numPages: doc.numPages }
    })()
    const data = await Promise.race([work, timeout])
    if (data.numPages > PDF_MAX_PAGES) {
      return { text: "", warning: `PDF has too many pages (maximum ${PDF_MAX_PAGES}).` }
    }
    const text = (data.text || "").trim()
    return text.length >= 30 ? { text } : { text, warning: "Scanned or image-only PDF — little text extracted." }
  } catch (e) {
    // Generic message only: parser internals / paths must never reach the client.
    if (e instanceof ResumeLimitError) return { text: "", warning: "The PDF took too long to process." }
    return { text: "", warning: "Could not read the PDF file — it may be corrupted or password-protected." }
  } finally {
    if (timer) clearTimeout(timer)
    try { await task?.destroy() } catch { /* already torn down */ }
  }
}

/** Locate word/document.xml in the docx zip via the End-Of-Central-Directory record. */
function extractDocxXml(buf: Buffer): string | null {
  const EOCD_SIG = 0x06054b50
  const CEN_SIG = 0x02014b50
  // Find EOCD scanning backwards (comment is usually empty; cap the scan).
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_536); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) return null
  let ptr = buf.readUInt32LE(eocd + 16) // offset of central directory
  const count = buf.readUInt16LE(eocd + 10)

  for (let n = 0; n < count && ptr + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(ptr) !== CEN_SIG) break
    const method = buf.readUInt16LE(ptr + 10)
    const compSize = buf.readUInt32LE(ptr + 20)
    const declaredSize = buf.readUInt32LE(ptr + 24) // uncompressed size claimed by the zip
    const nameLen = buf.readUInt16LE(ptr + 28)
    const extraLen = buf.readUInt16LE(ptr + 30)
    const commentLen = buf.readUInt16LE(ptr + 32)
    const localOff = buf.readUInt32LE(ptr + 42)
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen)

    if (name === "word/document.xml") {
      // Reject up-front when the zip itself declares an oversized entry (zip-bomb guard);
      // inflate below is ALSO capped because the declared size can be forged.
      if (declaredSize > DOCX_MAX_UNCOMPRESSED_BYTES) throw new ResumeLimitError("docx-too-large")
      if (localOff + 30 > buf.length || compSize > buf.length) return null
      // Local header: 30 bytes fixed + filename + extra, then the data.
      const lhNameLen = buf.readUInt16LE(localOff + 26)
      const lhExtraLen = buf.readUInt16LE(localOff + 28)
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen
      const raw = buf.subarray(dataStart, dataStart + compSize)
      try {
        if (method === 0 && raw.length > DOCX_MAX_UNCOMPRESSED_BYTES) throw new ResumeLimitError("docx-too-large")
        const out = method === 0 ? raw : zlib.inflateRawSync(raw, { maxOutputLength: DOCX_MAX_UNCOMPRESSED_BYTES })
        return out.toString("utf8")
      } catch (e) {
        // zlib throws ERR_BUFFER_TOO_LARGE when maxOutputLength is exceeded.
        if (e instanceof ResumeLimitError || (e as NodeJS.ErrnoException)?.code === "ERR_BUFFER_TOO_LARGE") {
          throw new ResumeLimitError("docx-too-large")
        }
        return null
      }
    }
    ptr += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/** Convert OOXML document.xml to readable text (paragraph breaks, tags stripped). */
function docxXmlToText(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function parseDocx(buf: Buffer): ParsedResume {
  const xml = extractDocxXml(buf)
  if (!xml) return { text: "", warning: "Could not read DOCX contents (unexpected file structure)." }
  const text = docxXmlToText(xml)
  return text.length >= 30 ? { text } : { text, warning: "DOCX contained little extractable text." }
}

/** Legacy .doc — scrape printable ASCII runs. Partial by nature. */
function parseLegacyDoc(buf: Buffer): ParsedResume {
  const runs = buf.toString("latin1").match(/[\x20-\x7E]{4,}/g) || []
  const text = runs.join(" ").replace(/\s{2,}/g, " ").trim()
  return {
    text,
    warning: "Legacy .doc parsing is best-effort — upload PDF or DOCX for accurate results.",
  }
}

/**
 * Extract resume text from a file buffer by extension. Never throws — a
 * malformed/corrupt file (e.g. a truncated DOCX zip whose header offsets are
 * out of range) is turned into a graceful warning rather than an exception, so
 * callers/routes always get a structured result instead of a 500.
 */
export async function extractResumeText(buf: Buffer, ext: string): Promise<ParsedResume> {
  const kind = extToKind(ext)
  if (!kind) return { text: "", warning: `Unsupported file type: .${ext}` }
  if (!buf || buf.length === 0) return { text: "", warning: "Empty file." }
  try {
    switch (kind) {
      case "pdf": return await parsePdf(buf)
      case "docx": return parseDocx(buf)
      case "doc": return parseLegacyDoc(buf)
      case "txt": return { text: buf.toString("utf8").trim() }
    }
  } catch (e) {
    if (e instanceof ResumeLimitError) {
      return { text: "", warning: "The document is too large or complex to process safely." }
    }
    return { text: "", warning: `Could not read the ${kind.toUpperCase()} file — it may be corrupted or password-protected.` }
  }
}
