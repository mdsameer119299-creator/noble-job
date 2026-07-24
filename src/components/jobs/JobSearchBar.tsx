'use client'
import { useJobFilters } from '@/hooks/useJobFilters'
import { useDebounce } from '@/hooks/useDebounce'
import { JOB_CATEGORIES, JOB_TYPES } from '@/lib/constants/jobCategories'
import { useState, useEffect } from 'react'

export function JobSearchBar() {
  const { q, category, setFilter } = useJobFilters()
  const [localQ, setLocalQ] = useState(q)
  const debouncedQ = useDebounce(localQ, 400)
  useEffect(() => { setFilter("q", debouncedQ) }, [debouncedQ])

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={localQ} onChange={e => setLocalQ(e.target.value)}
        placeholder="Search by job title, company or skill..."
        style={{ flex: 1, minWidth: 200, border: 'none', outline: 'none', fontSize: 14, color: '#0d1f4e' }}
      />
      <select value={category} onChange={e => setFilter("category", e.target.value)}
        style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151', background: '#fff' }}>
        <option value="">All Categories</option>
        <option value="blue-collar">Blue Collar Jobs (All)</option>
        {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select onChange={e => setFilter("type", e.target.value)}
        style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151', background: '#fff' }}>
        <option value="">All Types</option>
        {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  )
}
