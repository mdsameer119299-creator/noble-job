'use client'
import { useState } from 'react'
import { ApplicationModal } from './ApplicationModal'

interface ApplyButtonProps {
  jobId: string
  applyUrl?: string
  title?: string
  company?: string
  location?: string
  salary?: string
  board?: 'private' | 'govt' | 'wfh' | 'abroad'
}

/**
 * Private-job apply control. Opens Noble Job's internal application flow (a modal)
 * — it never redirects the candidate to an external site or opens a new tab. The
 * original employer URL (`applyUrl`) is forwarded to the application record as
 * metadata only and is never shown to the candidate.
 */
export function ApplyButton({ jobId, applyUrl, title, company, location, salary, board = 'private' }: ApplyButtonProps) {
  const [open, setOpen] = useState(false)
  const [applied, setApplied] = useState(false)

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
