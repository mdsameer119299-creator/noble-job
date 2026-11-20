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

async function parsePdf(buf: Buffer): Promise<ParsedResume> {
  try {
    const mod = await import("pdf-parse/lib/pdf-parse.js")
    const pdf = (mod as unknown as {
      default: (b: Buffer, o?: { max?: number }) => Promise<{ text: string; numpages: number }>
    }).default
    // `max` stops page processing after PDF_MAX_PAGES; numpages still reports the real total.
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new ResumeLimitError("pdf-timeout")), PDF_PARSE_TIMEOUT_MS)
    })
    let data: { text: string; numpages: number }
    try {
      try {
        data = await Promise.race([pdf(Buffer.from(buf), { max: PDF_MAX_PAGES }), timeout])
      } catch (first) {
        if (first instanceof ResumeLimitError) throw first
        // pdf.js 1.x can fail its very first parse in a fresh process (observed: "bad XRef entry"
        // on a valid file, succeeding on retry). Retry once; genuinely broken files fail again.
        data = await Promise.race([pdf(Buffer.from(buf), { max: PDF_MAX_PAGES }), timeout])
      }
    } finally {
      if (timer) clearTimeout(timer)
    }
    if (data.numpages > PDF_MAX_PAGES) {
      return { text: "", warning: `PDF has too many pages (maximum ${PDF_MAX_PAGES}).` }
    }
    const text = (data.text || "").trim()
    return text.length >= 30 ? { text } : { text, warning: "Scanned or image-only PDF — little text extracted." }
  } catch (e) {
    // Generic message only: parser internals / paths must never reach the client.
    if (e instanceof ResumeLimitError) return { text: "", warning: "The PDF took too long to process." }
    return { text: "", warning: "Could not read the PDF file — it may be corrupted or password-protected." }
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
