'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { RoleToggle } from '@/components/auth/RoleToggle'
import { EmployerLoginForm } from '@/components/auth/EmployerLoginForm'
import { CandidateLoginForm } from '@/components/auth/CandidateLoginForm'
import { EmployerRegisterWizard } from '@/components/auth/EmployerRegisterWizard'
import { CandidateRegisterWizard } from '@/components/auth/CandidateRegisterWizard'
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons'
import { AuthBrandHeader } from '@/components/auth/AuthBrandHeader'
import { SupabaseConfigBanner } from '@/components/auth/SupabaseConfigBanner'
import '@/styles/auth.css'

function AuthContent() {
  const sp = useSearchParams()
  const [role, setRole] = useState<'employer' | 'candidate'>('candidate')
  const [tab, setTab] = useState<'login' | 'register'>('login')

  useEffect(() => {
    const r = sp.get('role')
    const t = sp.get('tab')
    if (r === 'employer' || r === 'candidate') setRole(r)
    if (t === 'login' || t === 'register') setTab(t)
  }, [sp])

  return (
    <div className="auth-page">
      <div className="auth-page__inner">
        <header className="auth-page__header">
          <AuthBrandHeader />
          <h1 className="auth-page__title">
            {tab === 'login' ? 'Welcome Back!' : 'Join Noble Job'}
          </h1>
          <p className="auth-page__subtitle">
            {tab === 'login' ? 'Sign in to your account' : 'Create your free account today'}
          </p>
        </header>

        <div className="auth-page__card">
          <SupabaseConfigBanner />
          <RoleToggle role={role} onChange={setRole} />

          <div className="auth-tab-toggle">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                type="button"
                className={`auth-tab-btn ${tab === t ? 'auth-tab-btn--active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>

          {tab === 'login' && (
            <>
              {role === 'employer' ? <EmployerLoginForm /> : <CandidateLoginForm />}
              <div style={{ marginTop: 20 }}>
                <SocialLoginButtons role={role} />
              </div>
            </>
          )}
          {tab === 'register' &&
            (role === 'employer' ? <EmployerRegisterWizard /> : <CandidateRegisterWizard />)}
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  )
}
