'use client'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'
interface ForgotPasswordModalProps { open: boolean; onClose: () => void }
export function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const toast = useToast()
  const handleSend = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email'); return }
    setLoading(true)
    const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    if (res.ok) setSent(true); else toast.error('Failed to send OTP')
    setLoading(false)
  }
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,31,78,.5)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>📧</div>
            <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 8 }}>OTP Sent!</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Check <strong>{email}</strong> for your 6-digit OTP.</p>
            <a href={`/auth/reset-password?email=${encodeURIComponent(email)}`} style={{ display: 'inline-block', background: '#1847d4', color: '#fff', border: 'none', padding: '11px 28px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 14, textDecoration: 'none', marginRight: 8 }}>Enter OTP</a>
            <button onClick={onClose} style={{ background: '#f8faff', border: '1.5px solid #e2e8f0', color: '#374151', padding: '11px 28px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 6 }}>Forgot Password?</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Enter your registered email and we&apos;ll send you an OTP.</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: '#f8faff', border: '1.5px solid #e2e8f0', color: '#374151', padding: '11px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={handleSend} disabled={loading} style={{ flex: 1, background: '#1847d4', color: '#fff', border: 'none', padding: '11px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1 }}>{loading ? 'Sending…' : 'Send OTP'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
