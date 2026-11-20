/**
 * boundedBody.ts — read a request body with a hard byte ceiling.
 *
 * `Content-Length` is checked up-front (cheap rejection before any bytes are
 * read), AND the stream is counted while reading so a client that lies about,
 * or omits, the header (chunked encoding) still cannot make us buffer more than
 * `maxBytes`.
 */
export type BoundedReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 411 | 413; error: string }

export async function readBodyLimited(req: Request, maxBytes: number): Promise<BoundedReadResult> {
  const header = req.headers.get("content-length")
  if (header === null || header.trim() === "") {
    return { ok: false, status: 411, error: "Content-Length header is required." }
  }
  if (!/^\d+$/.test(header.trim())) {
    return { ok: false, status: 400, error: "Invalid Content-Length header." }
  }
  const declared = Number(header.trim())
  if (!Number.isSafeInteger(declared) || declared > maxBytes) {
    return { ok: false, status: 413, error: "Upload is too large." }
  }
  if (!req.body) return { ok: true, bytes: new Uint8Array(0) }

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, status: 413, error: "Upload is too large." }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400, error: "Could not read the upload." }
  }
  const bytes = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength }
  return { ok: true, bytes }
}
