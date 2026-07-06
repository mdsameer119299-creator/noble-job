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
    const pdf = (mod as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default
    const data = await pdf(buf)
    const text = (data.text || "").trim()
    return text.length >= 30 ? { text } : { text, warning: "Scanned or image-only PDF — little text extracted." }
  } catch (e) {
    return { text: "", warning: `PDF parse failed: ${e instanceof Error ? e.message : "unknown error"}` }
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
    const nameLen = buf.readUInt16LE(ptr + 28)
    const extraLen = buf.readUInt16LE(ptr + 30)
    const commentLen = buf.readUInt16LE(ptr + 32)
    const localOff = buf.readUInt32LE(ptr + 42)
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen)

    if (name === "word/document.xml") {
      // Local header: 30 bytes fixed + filename + extra, then the data.
      const lhNameLen = buf.readUInt16LE(localOff + 26)
      const lhExtraLen = buf.readUInt16LE(localOff + 28)
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen
      const raw = buf.subarray(dataStart, dataStart + compSize)
      try {
        const out = method === 0 ? raw : zlib.inflateRawSync(raw)
        return out.toString("utf8")
      } catch {
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
  } catch {
    return { text: "", warning: `Could not read the ${kind.toUpperCase()} file — it may be corrupted or password-protected.` }
  }
}
