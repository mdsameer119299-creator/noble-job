'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PasswordInput } from './PasswordInput'
import { ForgotPasswordModal } from './ForgotPasswordModal'
import { useToast } from '@/hooks/useToast'
import { useAuthConfigured } from './SupabaseConfigBanner'
import { AUTH_UNAVAILABLE_MESSAGE } from '@/lib/supabase/guards'

export function CandidateLoginForm() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const toast = useToast()
  const router = useRouter()
  const authConfigured = useAuthConfigured()

  const handleLogin = async () => {
    if (!authConfigured) {
      toast.error(AUTH_UNAVAILABLE_MESSAGE)
      return
    }
    if (!form.email || !form.password) {
      toast.error('Fill all fields')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Welcome back!')
      router.push('/candidate/dashboard')
    } else {
      toast.error(data.error || AUTH_UNAVAILABLE_MESSAGE)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: authConfigured ? 1 : 0.65 }}>
      <div className="auth-field">
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>
          Email Address
        </label>
        <input
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="you@email.com"
          disabled={!authConfigured}
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
      <PasswordInput
        label="Password"
        value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        placeholder="Your password"
        disabled={!authConfigured}
      />
      <div style={{ textAlign: 'right' }}>
        <button
          type="button"
          onClick={() => authConfigured && setShowForgot(true)}
          disabled={!authConfigured}
          style={{
            color: '#1847d4',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            cursor: authConfigured ? 'pointer' : 'not-allowed',
          }}
        >
          Forgot password?
        </button>
      </div>
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading || !authConfigured}
        className="auth-submit auth-submit--candidate"
      >
        {loading ? 'Logging in…' : 'Login to Job Seeker Account'}
      </button>
      <ForgotPasswordModal open={showForgot && authConfigured} onClose={() => setShowForgot(false)} />
    </div>
  )
}
