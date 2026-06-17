'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/hooks/useToast'
import { validateResumeFile } from '@/lib/utils/resumeUpload'

interface ApplicationModalProps {
  open: boolean
  onClose: () => void
  jobId: string
  board?: 'private' | 'govt' | 'wfh' | 'abroad'
  title?: string
  company?: string
  location?: string
  salary?: string
  /** Original employer/source URL — sent as metadata only, never shown to the candidate. */
  sourceUrl?: string
  source?: string
  onApplied?: () => void
}

type Auth = 'unknown' | 'candidate' | 'guest'

interface Profile {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  category?: string | null
  experience_years?: string | null
  skills?: string[] | null
  resume_url?: string | null
  profile_score?: number | null
}

const PROFILE_FIELDS: (keyof Profile)[] = ['first_name', 'last_name', 'phone', 'city', 'category', 'experience_years']

function completionPct(p: Profile, hasResume: boolean): number {
  if (p.profile_score && p.profile_score > 0) return Math.min(100, p.profile_score)
  let filled = PROFILE_FIELDS.filter((f) => p[f]).length
  if (p.skills && p.skills.length > 0) filled++
  if (hasResume) filled++
  return Math.round((filled / (PROFILE_FIELDS.length + 2)) * 100)
}

function resumeFileName(path?: string | null): string | null {
  if (!path) return null
  const ext = path.split('.').pop()?.toLowerCase()
  return ext ? `resume.${ext}` : 'resume'
}

export function ApplicationModal({ open, onClose, jobId, board = 'private', title, company, location, salary, sourceUrl, source, onApplied }: ApplicationModalProps) {
  const [auth, setAuth] = useState<Auth>('unknown')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile>({})
  const [email, setEmail] = useState('')
  const [hasResume, setHasResume] = useState(false)
  const [resumeName, setResumeName] = useState<string | null>(null)
  const [coverNote, setCoverNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const toast = useToast()

  // Load profile + auth in the background — the modal shell is already on screen,
  // so this never blocks the open (sub-200ms) and shows inline skeletons, not a popup.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setDone(false)
    ;(async () => {
      try {
        const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => ({}))
        if (cancelled) return
        if (!me?.user) {
          setAuth('guest')
          setLoading(false)
          return
        }
        if (me.user.role && me.user.role !== 'candidate') {
          setAuth('guest')
          setLoading(false)
          return
        }
        setAuth('candidate')
        setEmail(me.user.email || '')
        const prof = await fetch('/api/candidate/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null)
        if (cancelled) return
        const p: Profile = prof?.data || {}
        setProfile(p)
        setHasResume(Boolean(p.resume_url))
        setResumeName(resumeFileName(p.resume_url))
      } catch {
        /* leave skeletons; submit will surface any real error */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const goAuth = (mode: 'login' | 'register') => {
    const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
    const base = mode === 'register' ? '/auth?role=candidate&tab=register' : '/auth?role=candidate'
    router.push(`${base}&redirect=${encodeURIComponent(here)}`)
  }

  const pickFile = () => fileRef.current?.click()

  const onFile = async (file: File) => {
    const v = validateResumeFile(file)
    if (!v.ok) {
      toast.error(v.error)
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/candidate/resume', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setHasResume(true)
        setResumeName(file.name)
        toast.success('Resume uploaded')
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } finally {
      setUploading(false)
    }
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
        setAuth('guest')
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
      setDone(true)
      onApplied?.()
    } catch {
      toast.error('Could not submit application')
    } finally {
      setSubmitting(false)
    }
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  const pct = completionPct(profile, hasResume)

  return (
    <Modal open={open} onClose={onClose} maxWidth="560px">
      {/* Header */}
      <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #eef2fb', background: 'linear-gradient(180deg,#f8faff,#fff)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#1847d4', marginBottom: 6 }}>
          Apply on Noble Job
        </div>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, lineHeight: 1.25, margin: 0 }}>
          {title || 'this job'}
        </h2>
        {company && <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0', fontWeight: 600 }}>{company}</p>}
        {(location || salary) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {location && <span style={metaChip}>📍 {location}</span>}
            {salary && <span style={metaChip}>💰 {salary}</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '20px 26px', maxHeight: '60vh', overflowY: 'auto' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 14px' }}>✅</div>
            <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 19, marginBottom: 8 }}>Application submitted</h3>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
              Your application for <strong style={{ color: '#0d1f4e' }}>{title || 'this job'}</strong> is saved on Noble Job. Track its status from your dashboard — no need to go anywhere else.
            </p>
          </div>
        ) : auth === 'guest' ? (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🔐</div>
            <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 18, marginBottom: 6 }}>Sign in to apply</h3>
            <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 18px' }}>
              Apply with your Noble Job job-seeker account. You&apos;ll come right back to this job after signing in — and you stay on Noble Job the whole time.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button type="button" onClick={() => goAuth('login')} style={btnPrimary}>Log in</button>
              <button type="button" onClick={() => goAuth('register')} style={btnOutline}>Create account</button>
            </div>
            <p style={{ ...trustMsg, marginTop: 18 }}>🔒 Noble Job never charges candidates. Your application stays on Noble Job.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Candidate Profile card */}
            <section style={cardStyle}>
              <div style={sectionLabel}>Your profile</div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#1847d4,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, flexShrink: 0 }}>
                    {(fullName || 'NJ').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0d1f4e' }}>{fullName || 'Your profile'}</div>
                    <div style={{ fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                        <span>Profile completion</span>
                        <span style={{ color: pct >= 70 ? '#15803d' : '#b45309' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: '#e8eefb', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: pct >= 70 ? '#16a34a' : '#1847d4', transition: 'width .4s ease' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Resume section */}
            <section style={cardStyle}>
              <div style={sectionLabel}>Resume <span style={{ color: '#ef4444' }}>*</span></div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
              {loading ? (
                <Skeleton className="h-9 w-40" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" onClick={pickFile} disabled={uploading} style={btnUpload}>
                    {uploading ? 'Uploading…' : hasResume ? '↻ Replace resume' : '⬆ Upload resume'}
                  </button>
                  {hasResume && resumeName && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef6ff', color: '#1847d4', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 700 }}>
                      📄 {resumeName}
                    </span>
                  )}
                </div>
              )}
              <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '8px 0 0' }}>PDF, DOC or DOCX · Max 5 MB</p>
            </section>

            {/* Message to Employer */}
            <section style={cardStyle}>
              <div style={sectionLabel}>Message to employer <span style={{ color: '#94a3b8', fontWeight: 600 }}>(optional)</span></div>
              <textarea
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                maxLength={2000}
                placeholder="Briefly share why you're a strong fit for this role — your relevant experience, key skills, and what excites you about the opportunity."
                style={{ width: '100%', minHeight: 92, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 13px', fontSize: 13.5, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#0d1f4e', fontFamily: 'inherit' }}
              />
            </section>

            <p style={trustMsg}>🔒 Your application stays on Noble Job. We never charge candidates or share your details without consent.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {!done && auth !== 'guest' && (
        <div style={{ padding: '16px 26px', borderTop: '1px solid #eef2fb', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fcfdff' }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="button" onClick={submit} disabled={submitting || loading || !hasResume}
            style={{ ...btnPrimary, opacity: submitting || loading || !hasResume ? 0.55 : 1, cursor: submitting || loading || !hasResume ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      )}
      {done && (
        <div style={{ padding: '16px 26px', borderTop: '1px solid #eef2fb', display: 'flex', justifyContent: 'flex-end', background: '#fcfdff' }}>
          <button type="button" onClick={onClose} style={btnPrimary}>Done</button>
        </div>
      )}
    </Modal>
  )
}

const metaChip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef2fb', color: '#334155', borderRadius: 16, padding: '4px 11px', fontSize: 12.5, fontWeight: 600 }
const trustMsg: React.CSSProperties = { fontSize: 11.5, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5, margin: 0 }
const cardStyle: React.CSSProperties = { background: '#f8faff', border: '1px solid #eef2fb', borderRadius: 14, padding: '14px 16px' }
const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#0d1f4e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }
const btnPrimary: React.CSSProperties = { background: '#1847d4', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'all .15s' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1847d4', border: '1.5px solid #1847d4', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const btnUpload: React.CSSProperties = { background: '#fff', color: '#1847d4', border: '1.5px solid #c7d7fe', padding: '9px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
