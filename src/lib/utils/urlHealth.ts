/**
 * Shared external-URL health checks. Used by:
 *  - /api/validate-url (per-click Apply guard)
 *  - /api/cron/validate-apply-urls (periodic sweep of stored job links)
 *
 * Detects dead links: invalid URLs, DNS failures (NXDOMAIN), refused connections,
 * TLS errors, timeouts, and 4xx/5xx responses.
 */

// Block internal/metadata targets to prevent SSRF through these fetchers.
const BLOCKED_HOST =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|::1|metadata\.|.*\.internal)$/i

export function validateUrlShape(raw: string | null | undefined): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    if (BLOCKED_HOST.test(u.hostname)) return null
    return u
  } catch {
    return null
  }
}

export async function probeUrl(
  url: string,
  timeoutMs = 6000
): Promise<{ ok: boolean; status: number | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal })
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal })
    }
    return { ok: res.status >= 200 && res.status < 400, status: res.status }
  } catch {
    return { ok: false, status: null }
  } finally {
    clearTimeout(timer)
  }
}
