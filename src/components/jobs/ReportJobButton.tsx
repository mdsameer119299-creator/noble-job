'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

interface ReportJobButtonProps {
  board: 'private' | 'wfh' | 'abroad' | 'govt'
  jobId: string
  jobTitle?: string
}

const REASONS: { value: string; label: string }[] = [
  { value: 'fake_or_spam', label: 'Fake or spam listing' },
  { value: 'asks_for_money', label: 'Asks candidates for money' },
  { value: 'expired_but_showing', label: 'Expired but still showing as open' },
  { value: 'discriminatory', label: 'Discriminatory requirements' },
  { value: 'other', label: 'Something else' },
]

export function ReportJobButton({ board, jobId, jobTitle }: ReportJobButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    setOpen(false)
    setTimeout(() => { setDone(false); setReason(''); setNote(''); setError('') }, 200)
  }

  const submit = async () => {
    if (!reason) { setError('Please choose a reason'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/jobs/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, jobId, jobTitle, reason, note }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json?.error || 'Could not submit report'); return }
      setDone(true)
    } catch {
      setError('Could not submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Report job" style={btn}>
        🚩 Report
      </button>

      <Modal open={open} onClose={close} maxWidth="420px">
        <div style={{ padding: '20px 24px' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>✅</div>
              <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 17, marginBottom: 6 }}>Thanks — we&apos;ll review this listing</h3>
              <button type="button" onClick={close} style={{ ...btnPrimary, marginTop: 14 }}>Close</button>
            </div>
          ) : (
            <>
              <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 17, marginBottom: 4 }}>Report this job</h3>
              <p style={{ color: '#64748b', fontSize: 12.5, marginBottom: 14 }}>{jobTitle}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {REASONS.map(r => (
                  <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#0d1f4e', cursor: 'pointer' }}>
                    <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                    {r.label}
                  </label>
                ))}
              </div>

              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={1000}
                placeholder="Additional details (optional)"
                style={{ width: '100%', minHeight: 70, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#0d1f4e', fontFamily: 'inherit', marginBottom: 12 }}
              />

              {error && <p style={{ color: '#be123c', fontSize: 12, marginBottom: 10 }} role="alert">{error}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={close} style={btnGhost}>Cancel</button>
                <button type="button" onClick={submit} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}

const btn: React.CSSProperties = { background: 'transparent', border: '1.5px solid #e2e8f0', color: '#6b7280', padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { background: '#1847d4', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', padding: '9px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
