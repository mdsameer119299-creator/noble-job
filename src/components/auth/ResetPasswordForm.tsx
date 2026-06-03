'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OtpInput } from '@/components/auth/OtpInput'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [otp, setOtp] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const router = useRouter()

  const handleReset = async () => {
    if (!email.includes('@')) {
      toast.error('Enter your registered email')
      return
    }
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit OTP from your email')
      return
    }
    if (pw.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (pw !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, password: pw, confirmPassword: confirm }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Password updated!')
      router.push('/auth')
    } else toast.error(data.error || 'Reset failed')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 20,
          border: '1.5px solid #e2e8f0',
          padding: '32px 28px',
          boxShadow: '0 8px 40px rgba(24,71,212,.08)',
        }}
      >
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 24, marginBottom: 6 }}>
          Reset Password
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
          Enter the OTP from your email and choose a new password.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              style={{
                width: '100%',
                border: '1.5px solid #e2e8f0',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <OtpInput length={6} value={otp} onChange={setOtp} />
          <PasswordInput label="New Password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters" />
          <PasswordInput label="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" />
          <Button variant="blue" onClick={handleReset} loading={loading} className="w-full mt-2">
            Reset Password
          </Button>
        </div>
      </div>
    </div>
  )
}
