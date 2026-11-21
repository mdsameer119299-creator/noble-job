'use client'
import { useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { validateResumeFile } from '@/lib/utils/resumeUpload'

interface ResumeUploaderProps {
  onUploaded?: (url: string) => void
}

export function ResumeUploader({ onUploaded }: ResumeUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleFile = async (file: File) => {
    // Same rule as the server (4 MB, PDF/DOC/DOCX): a clear message here instead of a platform error after a long upload.
    const v = validateResumeFile(file)
    if (!v.ok) { toast.error(v.error); return }
    setLoading(true)
    const form = new FormData()
    form.append('file', file)
    let res: Response
    try { res = await fetch('/api/candidate/resume', { method: 'POST', body: form }) } catch { setLoading(false); toast.error('Network error. Please try again.'); return }
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.ok) {
      toast.success('Resume uploaded successfully')
      onUploaded?.(data.url)
    } else {
      toast.error(data.error || 'Upload failed')
    }
  }

  return (
    <div
      style={{
        border: '2px dashed #c7d7fe',
        borderRadius: 14,
        padding: 28,
        textAlign: 'center',
        background: '#f8faff',
        cursor: loading ? 'wait' : 'pointer',
      }}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
      <p style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 14, marginBottom: 4 }}>
        {loading ? 'Uploading…' : 'Click to upload resume'}
      </p>
      <p style={{ color: '#6b7280', fontSize: 12 }}>PDF, DOC, or DOCX · Max 4 MB</p>
    </div>
  )
}
