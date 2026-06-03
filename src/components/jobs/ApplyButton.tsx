'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'

interface ApplyButtonProps {
  jobId: string
  applyUrl?: string
  title?: string
  company?: string
  board?: 'private' | 'govt' | 'wfh' | 'abroad'
}

export function ApplyButton({ jobId, applyUrl, title, company, board = 'private' }: ApplyButtonProps) {
  const [applied, setApplied] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const router = useRouter()

  const handleApply = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, board, jobTitle: title, company }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        toast.error('Please log in as a job seeker to apply')
        router.push('/auth?redirect=' + encodeURIComponent(window.location.pathname))
        return
      }
      if (!res.ok) {
        toast.error(data.error || 'Could not save application')
        return
      }

      setApplied(true)
      toast.success(`Application saved for "${title || 'this job'}"`)
      if (applyUrl) window.open(applyUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleApply}
      disabled={applied || loading}
      style={{
        background: applied ? '#15803d' : '#1847d4',
        color: '#fff',
        padding: '10px 22px',
        borderRadius: 10,
        fontWeight: 800,
        fontSize: 14,
        border: 'none',
        cursor: applied || loading ? 'not-allowed' : 'pointer',
        transition: 'all .2s',
        opacity: loading ? 0.8 : 1,
      }}
    >
      {loading ? 'Applying…' : applied ? 'Applied ✓' : 'Apply Now →'}
    </button>
  )
}
