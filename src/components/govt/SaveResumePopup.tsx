'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/hooks/useToast'
import { validateResumeFile } from '@/lib/utils/resumeUpload'

interface SaveResumePopupProps {
  open: boolean
  onClose: () => void
  /** Called once the candidate is ready to leave — opens the official site. */
  onContinue: () => void
  jobTitle?: string
}

type Auth = 'unknown' | 'candidate' | 'guest'

function resumeFileName(path?: string | null): string | null {
  if (!path) return null
  const ext = path.split('.').pop()?.toLowerCase()
  return ext ? `resume.${ext}` : 'resume'
}

/**
 * Shown before a government job's "Apply Online" link sends the candidate to
 * the official recruitment site (Noble Job never submits govt applications
 * itself). Offers to save the candidate's resume for future private-job
 * opportunities, but never blocks or delays reaching the official site —
 * "Continue to official website" is always available.
 */
export function SaveResumePopup({ open, onClose, onContinue, jobTitle }: SaveResumePopupProps) {
  const [auth, setAuth] = useState<Auth>('unknown')
  const [loading, setLoading] = useState(true)
  const [hasResume, setHasResume] = useState(false)
  const [resumeName, setResumeName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({}))
        if (cancelled) return
        if (!me?.user || (me.user.role && me.user.role !== 'candidate')) {
          setAuth('guest')
          setLoading(false)
          return
        }
        setAuth('candidate')
        const prof = await fetch('/api/candidate/profile').then(r => (r.ok ? r.json() : null)).catch(() => null)
        if (cancelled) return
        const resumeUrl = prof?.data?.resume_url as string | undefined
        setHasResume(Boolean(resumeUrl))
        setResumeName(resumeFileName(resumeUrl))
      } catch {
        /* leave defaults — Continue still works either way */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const goAuth = (mode: 'login' | 'register') => {
    const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
    const base = mode === 'register' ? '/auth?role=candidate&tab=register' : '/auth?role=candidate'
    router.push(`${base}&redirect=${encodeURIComponent(here)}`)
  }

  const pickFile = () => fileRef.current?.click()

  const onFile = async (file: File) => {
    const v = validateResumeFile(file)
    if (!v.ok) { toast.error(v.error); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/candidate/resume', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setHasResume(true)
        setResumeName(file.name)
        toast.success('Resume saved')
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } finally {
      setUploading(false)
    }
  }

  const continueToSite = () => {
    onContinue()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="480px">
      <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #eef2fb', background: 'linear-gradient(180deg,#f8faff,#fff)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#1847d4', marginBottom: 6 }}>
          Before you go
        </div>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 20, lineHeight: 1.25, margin: 0 }}>
          Save your resume with Noble Job
        </h2>
      </div>

      <div style={{ padding: '20px 26px' }}>
        <p style={{ color: '#475569', fontSize: 13.5, lineHeight: 1.6, marginBottom: 16 }}>
          Government applications are submitted on the official recruitment website — we&apos;ll take you there next.
          While you&apos;re here, save your resume so private employers on Noble Job can find you for other
          opportunities{jobTitle ? ` like ${jobTitle}` : ''}.
        </p>

        {auth === 'guest' ? (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 10 }}>
              <button type="button" onClick={() => goAuth('login')} style={btnOutline}>Log in</button>
              <button type="button" onClick={() => goAuth('register')} style={btnOutline}>Create account</button>
            </div>
            <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0 }}>to save your resume for future opportunities</p>
          </div>
        ) : (
          <div style={{ background: '#f8faff', border: '1px solid #eef2fb', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
            />
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
          </div>
        )}

        <button type="button" onClick={continueToSite} style={btnPrimary}>
          Continue to official website →
        </button>
        <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: '10px 0 0' }}>
          Noble Job never submits government applications on your behalf.
        </p>
      </div>
    </Modal>
  )
}

const btnPrimary: React.CSSProperties = { width: '100%', background: '#1847d4', color: '#fff', border: 'none', padding: '13px', borderRadius: 10, fontWeight: 900, fontSize: 14.5, cursor: 'pointer' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1847d4', border: '1.5px solid #1847d4', padding: '9px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const btnUpload: React.CSSProperties = { background: '#fff', color: '#1847d4', border: '1.5px solid #c7d7fe', padding: '9px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
