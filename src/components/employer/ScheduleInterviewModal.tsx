'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'

interface ScheduleInterviewModalProps {
  open: boolean
  onClose: () => void
  applicationId: string
  candidateId: string
  employerId: string
  candidateName?: string
  onScheduled?: () => void
}

export function ScheduleInterviewModal({ open, onClose, applicationId, candidateId, employerId, candidateName, onScheduled }: ScheduleInterviewModalProps) {
  const [form, setForm] = useState({ scheduled_at: '', mode: 'online', link: '', notes: '', duration_mins: 60 })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const submit = async () => {
    if (!form.scheduled_at) { toast.error('Pick a date & time'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          candidate_id: candidateId,
          employer_id: employerId,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          duration_mins: Number(form.duration_mins) || 60,
          mode: form.mode,
          link: form.link || null,
          notes: form.notes || null,
          status: 'scheduled',
        }),
      })
      if (res.ok) { toast.success('Interview scheduled'); onScheduled?.(); onClose() }
      else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Could not schedule') }
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="480px">
      <div style={{ padding: 24 }}>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 20, marginBottom: 4 }}>Schedule interview</h2>
        {candidateName && <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>with {candidateName}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Date & time">
            <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} style={input} />
          </Field>
          <Field label="Mode">
            <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} style={input}>
              <option value="online">Online</option>
              <option value="phone">Phone</option>
              <option value="offline">In person</option>
            </select>
          </Field>
          <Field label="Meeting link / location (optional)">
            <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="https://meet… or office address" style={input} />
          </Field>
          <Field label="Notes (optional)">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...input, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={submit} disabled={saving} style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{saving ? 'Scheduling…' : 'Schedule'}</button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, boxSizing: 'border-box', color: '#0d1f4e' }
