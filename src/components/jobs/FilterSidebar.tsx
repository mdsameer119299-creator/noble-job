'use client'
import { useJobFilters } from '@/hooks/useJobFilters'
import { LOCATION_FILTERS, SALARY_RANGES, EXPERIENCE_LEVELS, JOB_TYPES } from '@/lib/constants/jobCategories'

function FilterGroup({ title, items, activeValues, onChange }: { title: string; items: {label: string; value: string}[]; activeValues: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0d1f4e', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>{title}</h4>
      {items.map(item => (
        <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={activeValues.includes(item.value)} onChange={() => onChange(item.value)}
            style={{ width: 15, height: 15, accentColor: '#1847d4' }} />
          <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
        </label>
      ))}
    </div>
  )
}

export function FilterSidebar() {
  const { location, salary, exp, type: jobType, setFilter, clearFilters } = useJobFilters()

  return (
    <aside className="filter-sidebar">
      <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '20px 18px', boxShadow: '0 2px 12px rgba(24,71,212,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 900, color: '#0d1f4e', fontSize: 16, margin: 0 }}>Filters</h3>
          <button onClick={clearFilters} style={{ color: '#1847d4', fontSize: 12, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Clear All</button>
        </div>
        <FilterGroup title="Location" items={LOCATION_FILTERS.map(l => ({ label: l, value: l }))} activeValues={location ? [location] : []} onChange={v => setFilter("location", v === location ? "" : v)} />
        <FilterGroup title="Salary Range" items={[...SALARY_RANGES]} activeValues={salary ? [salary] : []} onChange={v => setFilter("salary", v === salary ? "" : v)} />
        <FilterGroup title="Experience" items={EXPERIENCE_LEVELS.map(e => ({ label: e.label, value: e.value }))} activeValues={exp ? [exp] : []} onChange={v => setFilter("exp", v === exp ? "" : v)} />
        <FilterGroup title="Job Type" items={JOB_TYPES.map(t => ({ label: t, value: t }))} activeValues={jobType ? [jobType] : []} onChange={v => setFilter("type", v === jobType ? "" : v)} />
      </div>
    </aside>
  )
}
