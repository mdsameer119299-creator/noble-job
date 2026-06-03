'use client'
import { useState, InputHTMLAttributes, forwardRef } from 'react'
interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string }
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ label, error, className, ...props }, ref) => {
  const [show, setShow] = useState(false)
  return (
    <div style={{ width: '100%' }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input ref={ref} type={show ? 'text' : 'password'}
          style={{ width: '100%', borderRadius: 10, border: `1.5px solid ${error ? '#dc2626' : '#e2e8f0'}`, background: '#fff', color: '#0d1f4e', fontSize: 14, padding: '11px 44px 11px 16px', outline: 'none', boxSizing: 'border-box' }}
          {...props} />
        <button type="button" onClick={() => setShow(!show)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 700 }}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <p style={{ marginTop: 4, fontSize: 12, color: '#dc2626' }}>{error}</p>}
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'
