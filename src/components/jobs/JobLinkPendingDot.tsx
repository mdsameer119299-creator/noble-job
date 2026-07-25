'use client'
import { useLinkStatus } from 'next/link'

/**
 * Renders inside a <Link> (must be a direct descendant in the render tree —
 * see Next.js useLinkStatus) to give instant visual feedback while that
 * link's navigation is in flight. Job detail pages do a real server-side
 * data fetch with no route-level loading.tsx (removed deliberately so a
 * missing job returns a real 404 instead of a streamed 200 — see the 404/SEO
 * fix), so on a slow connection a click could sit with zero feedback for a
 * few seconds and look like it did nothing. This closes that gap without
 * touching the route-level loading behavior.
 */
export function JobLinkPendingDot() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block', width: 13, height: 13, marginLeft: 6, verticalAlign: 'middle',
        border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'nj-link-pending-spin .6s linear infinite', opacity: 0.7,
      }}
    />
  )
}
