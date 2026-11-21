/**
 * fileSignature.ts — verify a resume upload's REAL file type from its leading
 * bytes. The declared extension and MIME type are attacker-controlled and are
 * never sufficient on their own.
 */
import type { ResumeExt } from "./parse"

const PDF_MAGIC = Buffer.from("%PDF-", "latin1")
const ZIP_LOCAL_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // "PK\x03\x04"
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) // legacy .doc

function startsWith(buf: Buffer, magic: Buffer): boolean {
  return buf.length >= magic.length && buf.subarray(0, magic.length).equals(magic)
}

/** True when the buffer's leading bytes match the container format implied by `kind`. */
export function hasValidResumeSignature(buf: Buffer, kind: ResumeExt): boolean {
  switch (kind) {
    case "pdf": return startsWith(buf, PDF_MAGIC)
    case "docx": return startsWith(buf, ZIP_LOCAL_MAGIC)
    case "doc": return startsWith(buf, OLE_MAGIC)
    case "txt": return true
  }
}
