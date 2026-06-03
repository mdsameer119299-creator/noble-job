'use client'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

interface EmailAlertFormProps {
  board?: string
  placeholder?: string
  /** Stack input + button vertically (narrow sidebars). */
  layout?: 'row' | 'stack'
}

export function EmailAlertForm({
  board = 'all',
  placeholder = 'Enter your email for job alerts',
  layout = 'row',
}: EmailAlertFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubscribe = async () => {
    if (!email.includes('@')) { toast.error('Please enter a valid email'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, board }) })
      if (res.ok) { toast.success('Subscribed successfully! ✅'); setEmail('') }
      else toast.error('Failed to subscribe')
    } catch { toast.error('Failed to subscribe') }
    setLoading(false)
  }

  const stacked = layout === 'stack'

  return (
    <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: 8, width: '100%', minWidth: 0 }}>
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
        placeholder={placeholder}
        type="email"
        style={{
          flex: stacked ? undefined : 1,
          width: stacked ? '100%' : undefined,
          minWidth: 0,
          boxSizing: 'border-box',
          border: '1.5px solid #e2e8f0',
          borderRadius: 9,
          padding: '10px 14px',
          fontSize: 13,
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubscribe}
        disabled={loading}
        type="button"
        style={{
          background: '#f07020',
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '10px 18px',
          fontWeight: 800,
          fontSize: 13,
          cursor: 'pointer',
          width: stacked ? '100%' : 'auto',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '...' : 'Subscribe'}
      </button>
    </div>
  )
}
