'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { ResumeUploader } from '@/components/candidate/ResumeUploader'
import { useToast } from '@/hooks/useToast'

interface ApplicationModalProps {
  open: boolean
  onClose: () => void
  jobId: string
  board?: 'private' | 'govt' | 'wfh' | 'abroad'
  title?: string
  company?: string
  /** Original employer/source URL — sent as metadata only, never shown to the candidate. */
  sourceUrl?: string
  source?: string
  onApplied?: () => void
}

type Phase = 'loading' | 'form' | 'need-auth' | 'success' | 'error'

const heading: React.CSSProperties = {
  fontFamily: 'Playfair Display,serif',
  fontWeight: 900,
  color: '#0d1f4e',
  fontSize: 20,
}

export function ApplicationModal({ open, onClose, jobId, board = 'private', title, company, sourceUrl, source, onApplied }: ApplicationModalProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [hasResume, setHasResume] = useState(false)
  const [name, setName] = useState('')
  const [coverNote, setCoverNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const loadStatus = async () => {
    setPhase('loading')
    try {
      const meRes = await fetch('/api/auth/me')
      const me = await meRes.json().catch(() => ({}))
      if (!me?.user) {
        setPhase('need-auth')
        return
      }
      if (me.user.role && me.user.role !== 'candidate') {
        setPhase('need-auth')
        return
      }
      const profRes = await fetch('/api/candidate/profile')
      if (profRes.ok) {
        const p = await profRes.json().catch(() => ({}))
        const d = p?.data || {}
        setName([d.first_name, d.last_name].filter(Boolean).join(' ').trim())
      }
      const rRes = await fetch('/api/candidate/resume-url')
      const r = await rRes.json().catch(() => ({}))
      setHasResume(Boolean(r?.url))
      setPhase('form')
    } catch {
      setPhase('error')
    }
  }

  useEffect(() => {
    if (open) loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const goLogin = () => {
    const here = typeof window !== 'undefined' ? window.location.pathname : '/'
    router.push(`/auth?role=candidate&redirect=${encodeURIComponent(here)}`)
  }

  const submit = async () => {
    if (!hasResume) {
      toast.error('Please upload your resume before applying')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, board, jobTitle: title, company, sourceUrl, source, coverNote }),
      })
      if (res.status === 401) {
        setPhase('need-auth')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.error(data.error || 'You have already applied to this job')
        onClose()
        return
      }
      if (!res.ok) {
        toast.error(data.error || 'Could not submit application')
        return
      }
      setPhase('success')
      onApplied?.()
    } catch {
      toast.error('Could not submit application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="520px">
      <div style={{ padding: 24 }}>
        {phase === 'loading' && <p style={{ color: '#6b7280', fontSize: 14 }}>Preparing your application…</p>}

        {phase === 'error' && (
          <div>
            <h2 style={heading}>Something went wrong</h2>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '8px 0 16px' }}>Please try again.</p>
            <button type="button" onClick={loadStatus} style={btnPrimary}>Retry</button>
          </div>
        )}

        {phase === 'need-auth' && (
          <div>
            <h2 style={heading}>Sign in to apply</h2>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '8px 0 16px' }}>
              Apply with your Noble Job candidate account. You&apos;ll stay on Noble Job — we never send you to external sites.
            </p>
            <button type="button" onClick={goLogin} style={btnPrimary}>Log in as job seeker</button>
          </div>
        )}

        {phase === 'form' && (
          <div>
            <h2 style={heading}>Apply for {title || 'this job'}</h2>
            {company && <p style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{company}</p>}

            <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, margin: '16px 0' }}>
              <div style={{ fontSize: 13, color: '#374151' }}>
                Applying as <strong style={{ color: '#0d1f4e' }}>{name || 'your profile'}</strong>
              </div>
              <div style={{ fontSize: 13, marginTop: 6, color: hasResume ? '#15803d' : '#b45309', fontWeight: 700 }}>
                {hasResume ? '✓ Resume on file' : '⚠ Resume required to apply'}
              </div>
            </div>

            {!hasResume && (
              <div style={{ marginBottom: 16 }}>
                <ResumeUploader onUploaded={() => setHasResume(true)} />
              </div>
            )}

            <Textarea
              label="Cover note (optional)"
              placeholder="Add a short note for the employer…"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              maxLength={2000}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={submit} disabled={submitting || !hasResume} style={{ ...btnPrimary, opacity: submitting || !hasResume ? 0.6 : 1, cursor: submitting || !hasResume ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
              <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {phase === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
            <h2 style={heading}>Application submitted</h2>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '8px 0 18px' }}>
              Your application for {title || 'this job'} is saved on Noble Job. You&apos;ll hear back through your dashboard — no need to go anywhere else.
            </p>
            <button type="button" onClick={onClose} style={btnPrimary}>Done</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

const btnPrimary: React.CSSProperties = {
  background: '#1847d4', color: '#fff', border: 'none', padding: '11px 22px',
  borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: '#6b7280', border: '1.5px solid #e2e8f0',
  padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
