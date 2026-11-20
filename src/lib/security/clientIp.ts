/**
 * clientIp.ts — derive the client address used for abuse limiting.
 *
 * WHY NOT "first x-forwarded-for entry": a reverse proxy that APPENDS to the header leaves any
 * client-supplied value at the FRONT, so the first entry is attacker-controlled and rotating it
 * defeats per-client limits. A proxy appends the address it actually saw at the END, so the entry
 * counted from the right is the one added by infrastructure we control.
 *
 * TRUST MODEL (what is and is not verified)
 *  - Entries are counted from the RIGHT; `TRUSTED_PROXY_HOPS` (default 1) is how many trusted
 *    proxies sit in front of the app. With 1 hop the LAST entry is used. This is correct whether
 *    the single proxy OVERWRITES the header (one entry) or APPENDS to it.
 *  - Vercel overwrites x-forwarded-for with the real client address, so 1 hop is exact there.
 *  - Hostinger (production, single long-lived Node process) is NOT documented in this repo: its
 *    proxy's header handling has NOT been verified here, and nothing in this change touches hosting.
 *    If two proxies (e.g. a CDN in front of Hostinger) are in front, the last entry is the inner
 *    proxy, so many clients would share one bucket (stricter, not weaker) until the hop count is
 *    raised via the optional TRUSTED_PROXY_HOPS env var — an env var is NOT set or changed by this PR.
 *  - `x-real-ip` is only honoured on Vercel (where the platform sets it); elsewhere it is a plain
 *    client-controlled header and is ignored.
 *  - If no usable address exists the bucket is the literal "unknown": every such client shares one
 *    budget (fail-closed) and the global ceiling still applies.
 *
 * REMAINING RISK: if the real proxy chain is longer than TRUSTED_PROXY_HOPS the result is a shared
 * bucket (over-limiting), and if it is SHORTER (the app is reachable directly without a proxy) a
 * client can choose its own header value. The global ceiling bounds the total in both cases.
 */
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/
const IPV6 = /^[0-9a-fA-F:.]{2,45}$/

function plausibleIp(v: string | undefined | null): string | null {
  const t = (v ?? "").trim()
  if (!t || t.length > 45) return null
  return IPV4.test(t) || (t.includes(":") && IPV6.test(t)) ? t : null
}

export function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1
}

export function getTrustedClientIp(req: Request, hops = trustedProxyHops()): string {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map(s => s.trim()).filter(Boolean)
  if (xff.length > 0) {
    const ip = plausibleIp(xff[Math.max(0, xff.length - hops)])
    if (ip) return ip
  }
  if (process.env.VERCEL) {
    const ip = plausibleIp(req.headers.get("x-real-ip"))
    if (ip) return ip
  }
  return "unknown"
}
