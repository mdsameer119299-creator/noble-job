'use client'
import { PasswordInput } from './PasswordInput'
import type { CandidateRegisterErrors, CandidateRegisterField } from '@/lib/validations/candidateRegisterForm'
interface CandidateRegisterStep1Props {
  form: any
  onChange: (k: string, v: any) => void
  errors: CandidateRegisterErrors
  onBlurField?: (k: CandidateRegisterField) => void
}
const LABEL = { display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 } as const
const inputStyle = (err?: string) => ({ width: '100%', border: `1.5px solid ${err ? '#dc2626' : '#e2e8f0'}`, borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }) as const
const ERR = { marginTop: 4, fontSize: 12, color: '#dc2626' } as const

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? <p id={id} role="alert" style={ERR}>{msg}</p> : null
}

export function CandidateRegisterStep1({ form, onChange, errors, onBlurField }: CandidateRegisterStep1Props) {
  const a11y = (k: CandidateRegisterField) => ({ id: `cr-${k}`, 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `cr-${k}-err` : undefined, onBlur: () => onBlurField?.(k) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label htmlFor="cr-firstName" style={LABEL}>First Name *</label>
          <input {...a11y('firstName')} autoComplete="given-name" value={form.firstName || ''} onChange={e => onChange('firstName', e.target.value)} placeholder="First name" style={inputStyle(errors.firstName)} />
          <FieldError id="cr-firstName-err" msg={errors.firstName} />
        </div>
        <div>
          <label htmlFor="cr-lastName" style={LABEL}>Last Name *</label>
          <input {...a11y('lastName')} autoComplete="family-name" value={form.lastName || ''} onChange={e => onChange('lastName', e.target.value)} placeholder="Last name" style={inputStyle(errors.lastName)} />
          <FieldError id="cr-lastName-err" msg={errors.lastName} />
        </div>
      </div>
      <div>
        <label htmlFor="cr-email" style={LABEL}>Email Address *</label>
        <input {...a11y('email')} type="email" autoComplete="email" value={form.email || ''} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com" style={inputStyle(errors.email)} />
        <FieldError id="cr-email-err" msg={errors.email} />
      </div>
      <div>
        <label htmlFor="cr-phone" style={LABEL}>Phone Number <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
        <input {...a11y('phone')} type="tel" autoComplete="tel" value={form.phone || ''} onChange={e => onChange('phone', e.target.value)} placeholder="+91 98765 43210" style={inputStyle(errors.phone)} />
        <FieldError id="cr-phone-err" msg={errors.phone} />
      </div>
      <div>
        <PasswordInput id="cr-password" autoComplete="new-password" aria-invalid={errors.password ? true : undefined} aria-describedby={errors.password ? 'cr-password-err' : undefined}
          onBlur={() => onBlurField?.('password')} label="Create Password *" value={form.password || ''} onChange={e => onChange('password', e.target.value)} placeholder="Minimum 8 characters" error={undefined} />
        {errors.password
          ? <FieldError id="cr-password-err" msg={errors.password} />
          : <p style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>At least 8 characters, with one capital letter and one number.</p>}
      </div>
      <div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input id="cr-terms" type="checkbox" aria-invalid={errors.terms ? true : undefined} aria-describedby={errors.terms ? 'cr-terms-err' : undefined}
            checked={form.terms || false} onChange={e => onChange('terms', e.target.checked)} style={{ marginTop: 2, accentColor: '#1847d4', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>I agree to Noble Job&apos;s Terms of Service and Privacy Policy. Noble Job never charges candidates.</span>
        </label>
        <FieldError id="cr-terms-err" msg={errors.terms} />
      </div>
    </div>
  )
}
