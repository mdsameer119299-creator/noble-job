'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ResumeUploadWidget } from './ResumeUploadWidget'
import { track, AcqEvent } from '@/lib/analytics/events'

/**
 * Universal, sticky resume-upload call-to-action mounted site-wide. Shows a
 * floating button (desktop: bottom-right pill; mobile: bottom bar) on PUBLIC
 * pages only — hidden on authenticated dashboards and auth screens where it
 * would be noise. Opening it reveals the parse-first ResumeUploadWidget.
 *
 * Purely additive and client-only: it renders nothing on the server, does not
 * alter page content or links, and cannot affect SEO/indexing.
 */

// Routes where the acquisition dock should NOT appear.
const HIDDEN_PREFIXES = ['/candidate', '/employer', '/admin', '/auth']

export function ResumeCtaDock() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Respect a per-session dismissal so the button isn't naggy.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem('nj_dock_dismissed') === '1')
    } catch { /* ignore */ }
  }, [])

  const hidden = HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (hidden) return null

  function openWidget() {
    setOpen(true)
    track(AcqEvent.RESUME_CTA_OPENED, { path: pathname })
  }
  function dismiss() {
    setDismissed(true)
    try { sessionStorage.setItem('nj_dock_dismissed', '1') } catch { /* ignore */ }
  }

  return (
    <>
      {/* Floating trigger */}
      {!open && !dismissed && (
        <div className="nj-resume-dock" style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={openWidget}
            style={{ background: '#1847d4', color: '#fff', border: 'none', borderRadius: 999, padding: '13px 20px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 8px 24px rgba(24,71,212,.35)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            aria-label="Upload your resume for a free AI Career Report"
          >
            📄 Upload Resume &amp; Get AI Career Report
          </button>
          <button onClick={dismiss} aria-label="Dismiss" style={{ background: '#fff', color: '#6b7280', border: '1px solid #e2e8f0', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', fontSize: 15, lineHeight: 1, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>×</button>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Free resume score"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(13,31,78,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="nj-resume-sheet"
            style={{ background: '#fff', width: '100%', maxWidth: 460, borderRadius: '18px 18px 0 0', padding: '20px 20px 24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 19, margin: 0 }}>
                  Free AI Career Report
                </h2>
                <p style={{ color: '#6b7280', fontSize: 12.8, margin: '3px 0 0' }}>Career Score, skills &amp; matching jobs · no signup needed</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', fontSize: 24, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <ResumeUploadWidget source="dock" />
          </div>
        </div>
      )}
    </>
  )
}
