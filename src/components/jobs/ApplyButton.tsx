'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ApplicationModal } from './ApplicationModal'

interface ApplyButtonProps {
  jobId: string
  applyUrl?: string
  title?: string
  company?: string
  location?: string
  salary?: string
  board?: 'private' | 'govt' | 'wfh' | 'abroad'
  /**
   * SYNTHETIC / demo listing. Renders an unavailable state instead of the
   * application flow: no application is collected, so a candidate is never told
   * an employer received something that went nowhere. Genuine listings never set this.
   */
  sample?: boolean
}

/**
 * Private-job apply control. Opens Noble Job's internal application flow (a modal)
 * — it never redirects the candidate to an external site or opens a new tab. The
 * original employer URL (`applyUrl`) is forwarded to the application record as
 * metadata only and is never shown to the candidate.
 */
export function ApplyButton({ jobId, applyUrl, title, company, location, salary, board = 'private', sample = false }: ApplyButtonProps) {
  const [open, setOpen] = useState(false)
  const [applied, setApplied] = useState(false)

  if (sample) {
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
        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55, margin: '8px 0 0', maxWidth: 360 }}>
          This is a sample listing shown for reference. The role and company are illustrative, not a confirmed
          vacancy, and no application can be submitted.{' '}
          <Link href={listHref} style={{ color: '#1847d4', fontWeight: 700 }}>Browse current openings</Link>
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
        }}
      >
        {applied ? 'Applied ✓' : 'Apply Now →'}
      </button>

      <ApplicationModal
        open={open}
        onClose={() => setOpen(false)}
        jobId={jobId}
        board={board}
        title={title}
        company={company}
        location={location}
        salary={salary}
        sourceUrl={applyUrl}
        onApplied={() => setApplied(true)}
      />
    </>
  )
}
