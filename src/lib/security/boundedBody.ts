/**
 * boundedBody.ts — read a request body with a hard byte ceiling.
 *
 * `Content-Length` is checked up-front (cheap rejection before any bytes are
 * read), AND the stream is counted while reading so a client that lies about,
 * or omits, the header (chunked encoding) still cannot make us buffer more than
 * `maxBytes`.
 *
 * `timeoutMs` bounds how long the handler waits for the body once it starts reading (a stalled or
 * trickling client gets 408 instead of holding the request open). NOTE: it cannot shorten any time
 * the framework spends buffering the body BEFORE the handler runs (see src/middleware.ts matcher).
 */
export type BoundedReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 408 | 411 | 413; error: string }

export interface BoundedReadOptions {
  /** Reject requests without a Content-Length header (411). Default true. When false the streaming cap alone applies. */
  requireContentLength?: boolean
  /** Give up (408) if the whole body has not arrived within this many ms. Default: no deadline. */
  timeoutMs?: number
}

export async function readBodyLimited(req: Request, maxBytes: number, opts: BoundedReadOptions = {}): Promise<BoundedReadResult> {
  const header = req.headers.get("content-length")
  const hasHeader = header !== null && header.trim() !== ""
  if (!hasHeader) {
    if (opts.requireContentLength !== false) return { ok: false, status: 411, error: "Content-Length header is required." }
  } else if (!/^\d+$/.test(header.trim())) {
    return { ok: false, status: 400, error: "Invalid Content-Length header." }
  }
  if (hasHeader) {
    const declared = Number(header.trim())
    if (!Number.isSafeInteger(declared) || declared > maxBytes) {
      return { ok: false, status: 413, error: "Upload is too large." }
    }
  }
  if (!req.body) return { ok: true, bytes: new Uint8Array(0) }

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timedOut = false
  const timer = opts.timeoutMs
    ? setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined) }, opts.timeoutMs)
    : null
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
    return timedOut
      ? { ok: false, status: 408, error: "The upload took too long. Please try again." }
      : { ok: false, status: 400, error: "Could not read the upload." }
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (timedOut) return { ok: false, status: 408, error: "The upload took too long. Please try again." }
  const bytes = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength }
  return { ok: true, bytes }
}
