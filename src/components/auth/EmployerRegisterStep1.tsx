'use client'
import { PasswordInput } from './PasswordInput'
interface EmployerRegisterStep1Props { form: any; onChange: (k: string, v: any) => void; errors: any }
export function EmployerRegisterStep1({ form, onChange, errors }: EmployerRegisterStep1Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>First Name *</label>
          <input value={form.firstName || ''} onChange={e => onChange('firstName', e.target.value)} placeholder="First name"
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Last Name *</label>
          <input value={form.lastName || ''} onChange={e => onChange('lastName', e.target.value)} placeholder="Last name"
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Email Address *</label>
        <input type="email" value={form.email || ''} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com"
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Phone Number</label>
        <input type="tel" value={form.phone || ''} onChange={e => onChange('phone', e.target.value)} placeholder="+91 98765 43210"
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <PasswordInput label="Create Password *" value={form.password || ''} onChange={e => onChange('password', e.target.value)} placeholder="Minimum 8 characters" />
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.terms || false} onChange={e => onChange('terms', e.target.checked)} style={{ marginTop: 2, accentColor: '#1847d4', flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>I agree to Noble Job&apos;s Terms of Service and Privacy Policy. Noble Job never charges candidates.</span>
      </label>
    </div>
  )
}
