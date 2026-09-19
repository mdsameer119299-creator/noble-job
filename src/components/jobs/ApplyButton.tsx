'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ApplicationModal } from './ApplicationModal'
import { TALENT_REGISTRATION, type ApplyState } from '@/lib/jobs/applyRoute'

interface ApplyButtonProps {
  jobId: string
  /**
   * The honest application state of this job — `applyStateFor(board, job, company)`
   * (src/lib/jobs/applyRoute.ts). It decides WHAT is rendered:
   *   employer → "Apply Now": NobleJob's on-site flow; the application reaches the employer.
   *   external → a link to the genuine source's own application page (we do not receive it).
   *   sample   → a disabled control on a demo listing (no application is collected).
   *   closed   → the job is no longer open: no apply action.
   *   listing  → information only: NO apply action at all.
   */
  state: ApplyState
  title?: string
  company?: string
  location?: string
  salary?: string
  board?: 'private' | 'govt' | 'wfh' | 'abroad'
  /** Full-width control (detail modals). */
  block?: boolean
}

const noteStyle = { fontSize: 12, color: '#64748b', lineHeight: 1.55, margin: '8px 0 0', maxWidth: 380 } as const

/**
 * Apply control. Only the "employer" state opens NobleJob's application flow (a modal —
 * never a redirect); it is offered only when the application is DELIVERED to the
 * employer. The "external" state is an honest link out, "sample" is disabled, and
 * "listing" has no apply action — so a candidate is never told an application was
 * sent or stored for an employer that will never receive it.
 */
export function ApplyButton({ jobId, state, title, company, location, salary, board = 'private', block = false }: ApplyButtonProps) {
  const wide = block ? ({ display: 'block', width: '100%', textAlign: 'center', padding: '14px', borderRadius: 12, fontSize: 16, boxSizing: 'border-box' } as const) : {}
  const [open, setOpen] = useState(false)
  const [applied, setApplied] = useState(false)

  if (state.kind === 'sample') {
    const listHref = board === 'wfh' ? '/jobs/wfh' : board === 'abroad' ? '/jobs/abroad' : '/jobs/private'
    return (
      <div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          style={{
            background: '#e2e8f0',
            color: '#64748b',
            padding: '10px 22px',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            border: 'none',
            cursor: 'not-allowed',
          }}
        >
          Sample listing — applications closed
        </button>
        <p style={noteStyle}>
          {state.note}{' '}
          <Link href={listHref} style={{ color: '#1847d4', fontWeight: 700 }}>Browse current openings</Link>
        </p>
      </div>
    )
  }

  if (state.kind === 'external' && state.href) {
    return (
      <div>
        <a
          href={state.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{
            display: 'inline-block',
            background: '#1847d4',
            color: '#fff',
            padding: '10px 22px',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            textDecoration: 'none',
            ...wide,
          }}
        >
          {state.cta}
        </a>
        <p style={noteStyle}>{state.note}</p>
      </div>
    )
  }

  if (state.kind !== 'employer') {
    if (state.kind === 'closed') {
      return <p style={{ ...noteStyle, marginTop: 0, color: '#334155', fontWeight: 600 }}>{state.note}</p>
    }
    // "listing": information only. No Apply button, no application flow, no claim that
    // anything is sent or stored. A general profile is offered separately and labelled
    // as exactly that — never as an application to this vacancy.
    return (
      <div>
        <p style={{ ...noteStyle, marginTop: 0, color: '#334155', fontWeight: 600 }}>{state.note}</p>
        <p style={{ ...noteStyle, marginTop: 10 }}>
          <Link href={TALENT_REGISTRATION.href} style={{ color: '#1847d4', fontWeight: 700 }}>{TALENT_REGISTRATION.label}</Link>
          {' — '}{TALENT_REGISTRATION.note}
        </p>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={applied}
        style={{
          background: applied ? '#15803d' : '#1847d4',
          color: '#fff',
          padding: '10px 22px',
          borderRadius: 10,
          fontWeight: 800,
          fontSize: 14,
          border: 'none',
          cursor: applied ? 'not-allowed' : 'pointer',
          transition: 'all .2s',
          ...wide,
        }}
      >
        {applied ? 'Applied ✓' : state.cta}
      </button>
      <p style={noteStyle}>{state.note}</p>

      <ApplicationModal
        open={open}
        onClose={() => setOpen(false)}
        jobId={jobId}
        board={board}
        title={title}
        company={company}
        location={location}
        salary={salary}
        onApplied={() => setApplied(true)}
      />
    </>
  )
}
