/**
 * events.ts — lightweight, dependency-free client event tracking.
 *
 * Candidate-acquisition funnel instrumentation. Each event is (a) pushed to
 * `window.dataLayer` so a GTM/GA container can pick it up if/when configured,
 * and (b) beaconed to our own `/api/events` sink (best-effort; never blocks or
 * throws). No third-party SDK, no PII beyond what the caller passes.
 */

export const AcqEvent = {
  RESUME_CTA_OPENED: "resume_cta_opened",
  RESUME_UPLOAD: "resume_upload",
  RESUME_PARSED: "resume_parsed",
  RESUME_SCORE_GENERATED: "resume_score_generated",
  JOB_ALERT_SUBSCRIBED: "job_alert_subscribed",
  FIRST_APPLICATION: "first_application",
} as const

export type AcqEventName = (typeof AcqEvent)[keyof typeof AcqEvent]

type Props = Record<string, string | number | boolean | null | undefined>

const SID_KEY = "nj_sid"

/** Stable anonymous session id (localStorage). Empty string on the server. */
function sessionId(): string {
  if (typeof window === "undefined") return ""
  try {
    let sid = window.localStorage.getItem(SID_KEY)
    if (!sid) {
      sid =
        (crypto as Crypto | undefined)?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.localStorage.setItem(SID_KEY, sid)
    }
    return sid
  } catch {
    return ""
  }
}

/**
 * Fire an analytics event. Safe to call from anywhere on the client; a no-op on
 * the server. Failures are swallowed so tracking can never break a user flow.
 */
export function track(event: AcqEventName, props: Props = {}): void {
  if (typeof window === "undefined") return
  const payload = {
    event,
    props,
    path: window.location?.pathname || "",
    sid: sessionId(),
    ts: Date.now(),
  }

  // 1) dataLayer for GTM/GA (present only if a container is installed).
  try {
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event, ...props })
  } catch {
    /* ignore */
  }

  // 2) First-party sink. sendBeacon survives page unload; fall back to fetch.
  try {
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))
    } else {
      void fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } })
    }
  } catch {
    /* ignore */
  }
}
