'use client'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

interface SaveJobButtonProps { jobId: string; board?: string }

export function SaveJobButton({ jobId, board = 'private' }: SaveJobButtonProps) {
  const [saved, setSaved] = useState(false)
  const toast = useToast()

  const handleSave = async () => {
    try {
      const res = await fetch('/api/saved-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, board }) })
      if (res.ok) { setSaved(true); toast.success('Job saved!') }
      else toast.info('Please log in to save jobs')
    } catch { toast.error('Failed to save job') }
  }

  return (
    <button onClick={handleSave} title={saved ? 'Saved' : 'Save job'}
      style={{ background: saved ? '#eff6ff' : 'transparent', border: '1.5px solid', borderColor: saved ? '#1847d4' : '#e2e8f0', color: saved ? '#1847d4' : '#6b7280', padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 18, transition: 'all .2s' }}>
      {saved ? '🔖' : '🔖'}
    </button>
  )
}
