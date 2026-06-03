'use client'
import { useEffect, useState } from 'react'
import { ResumeUploader } from './ResumeUploader'

export function ResumeViewer() {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/candidate/resume-url')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setUrl(d?.url || null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ResumeUploader onUploaded={() => load()} />

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading resume…</p>
      ) : url ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginBottom: 12 }}>
            Current resume
          </h3>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#1847d4',
              fontWeight: 800,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            View / download resume →
          </a>
        </div>
      ) : (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No resume on file yet. Upload one above.</p>
      )}
    </div>
  )
}
