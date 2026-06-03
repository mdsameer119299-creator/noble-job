'use client'
import { useRef, KeyboardEvent } from 'react'
interface OtpInputProps { length?: number; value: string; onChange: (v: string) => void }
export function OtpInput({ length = 6, value, onChange }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length)
  const handleKey = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus()
  }
  const handleChange = (idx: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const d = [...digits]; d[idx] = v.slice(-1)
    onChange(d.join(''))
    if (v && idx < length - 1) refs.current[idx + 1]?.focus()
  }
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
      {digits.map((d, i) => (
        <input key={i} ref={el => { refs.current[i] = el }} value={d}
          onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
          maxLength={1} inputMode="numeric"
          style={{ width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 900, border: '2px solid', borderColor: d ? '#1847d4' : '#e2e8f0', borderRadius: 10, outline: 'none', color: '#0d1f4e', background: d ? '#eff6ff' : '#fff', transition: 'all .2s' }} />
      ))}
    </div>
  )
}
