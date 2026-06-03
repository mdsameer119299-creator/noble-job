'use client'
import { useState } from 'react'
import { OtpInput } from './OtpInput'
import { useToast } from '@/hooks/useToast'
interface OtpVerificationProps { email: string; onVerified: () => void }
export function OtpVerification({ email, onVerified }: OtpVerificationProps) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const handleVerify = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp, type: 'email_verify' }) })
    if (res.ok) { toast.success('Email verified! ✅'); onVerified() }
    else toast.error('Invalid or expired OTP')
    setLoading(false)
  }
  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>📧</div>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 6 }}>Verify Your Email</h3>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Enter the 6-digit OTP sent to <strong>{email}</strong></p>
      <OtpInput length={6} value={otp} onChange={setOtp} />
      <button onClick={handleVerify} disabled={loading || otp.length < 6}
        style={{ width: '100%', background: '#1847d4', color: '#fff', border: 'none', padding: '13px', borderRadius: 10, fontWeight: 900, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || otp.length < 6 ? 0.7 : 1 }}>
        {loading ? 'Verifying…' : 'Verify OTP'}
      </button>
      <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 12 }}>Didn&apos;t receive it? Check spam or wait 60 seconds.</p>
    </div>
  )
}
