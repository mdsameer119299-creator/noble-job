'use client'
import { useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'

interface ResumeUploaderProps {
  onUploaded?: (url: string) => void
}

export function ResumeUploader({ onUploaded }: ResumeUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleFile = async (file: File) => {
    setLoading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/candidate/resume', { method: 'POST', body: form })
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
      <p style={{ color: '#6b7280', fontSize: 12 }}>PDF, DOC, or DOCX · Max 5 MB</p>
    </div>
  )
}
