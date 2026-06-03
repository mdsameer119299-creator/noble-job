'use client'
import { useEffect, useState } from 'react'

export function ProfileCompleteness() {
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/candidate/ai-score')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setScore(d?.score ?? 0))
      .finally(() => setLoading(false))
  }, [])

  const pct = Math.min(100, Math.max(0, score))

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginBottom: 14 }}>
        Profile strength
      </h3>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Calculating…</p>
      ) : (
        <>
          <div style={{ height: 10, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#1847d4,#7c3aed)', borderRadius: 8 }} />
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#1847d4', marginBottom: 4 }}>{pct}%</p>
          <p style={{ color: '#6b7280', fontSize: 12 }}>Complete your profile and resume to improve matches.</p>
        </>
      )}
    </div>
  )
}
