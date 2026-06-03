'use client'
import { useJobFilters } from '@/hooks/useJobFilters'
import { getPaginationRange } from '@/lib/utils/pagination'

interface PaginationProps { totalPages: number }

export function Pagination({ totalPages }: PaginationProps) {
  const { page, setFilter } = useJobFilters()
  if (totalPages <= 1) return null
  const range = getPaginationRange(page, totalPages)
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 32 }}>
      <button onClick={() => setFilter("page", String(page - 1))} disabled={page === 1}
        style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: page === 1 ? '#f8faff' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#374151', fontWeight: 700 }}>
        ‹
      </button>
      {range.map(n => (
        <button key={n} onClick={() => setFilter("page", String(n))}
          style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid', fontWeight: 800, cursor: 'pointer',
            borderColor: n === page ? '#1847d4' : '#e2e8f0', background: n === page ? '#1847d4' : '#fff', color: n === page ? '#fff' : '#374151' }}>
          {n}
        </button>
      ))}
      <button onClick={() => setFilter("page", String(page + 1))} disabled={page === totalPages}
        style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: page === totalPages ? '#f8faff' : '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: '#374151', fontWeight: 700 }}>
        ›
      </button>
    </div>
  )
}
