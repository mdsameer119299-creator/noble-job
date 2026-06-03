'use client'
import { useJobFilters } from '@/hooks/useJobFilters'

export function SortDropdown() {
  const { sort, setFilter } = useJobFilters()
  return (
    <select value={sort} onChange={e => setFilter("sort", e.target.value)}
      style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer' }}>
      <option value="latest">Latest First</option>
      <option value="salary_high">Salary: High to Low</option>
      <option value="applicants">Most Applied</option>
    </select>
  )
}
