'use client'
import { useEffect, useState } from 'react'
import { JobCard } from './JobCard'
import { JobsLoadingSkeleton } from './JobsLoadingSkeleton'
import { SourceDisclaimer } from './SourceDisclaimer'
import { useJobFilters } from '@/hooks/useJobFilters'
import { toListingJobs, toLiveExternalJobs } from '@/lib/jobs/clientRecords'
import type { Job } from '@/types/job'

type Counts = { all: number; live: number; verified: number; archived: number }

const STATUS_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Jobs' },
  { id: 'LIVE_JOB', label: 'Live Jobs' },
  { id: 'VERIFIED_JOB', label: 'Verified Jobs' },
  { id: 'ARCHIVED_JOB', label: 'Archived Jobs' },
]

export function LiveJobsList() {
  const { q, category, type, location, exp, status, page, setFilter, setPage } = useJobFilters()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<Counts>({ all: 0, live: 0, verified: 0, archived: 0 })

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category && category !== 'all') params.set('category', category)
    if (type && type !== 'all') params.set('type', type)
    if (location) params.set('location', location)
    if (exp) params.set('exp', exp)
    if (status && status !== 'all') params.set('status', status)
    params.set('page', String(page))

    // External live jobs only matter when viewing all/live and on the first page.
    const includeLive = (status === 'all' || status === 'LIVE_JOB') && page === 1

    Promise.all([
      fetch(`/api/jobs?${params}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      includeLive
        ? fetch(`/api/jobs/live`).then(r => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ]).then(([dbData, liveData]) => {
      // The list API failing is an ERROR state, not "no jobs match" — and never a job.
      if (!dbData) {
        setFailed(true)
        setJobs([])
        setTotal(0)
        setTotalPages(1)
        setCounts({ all: 0, live: 0, verified: 0, archived: 0 })
        return
      }
      setFailed(false)
      // Every record is re-checked here: anything incomplete (no title / company /
      // description / location, unknown provenance) is dropped, nothing is defaulted.
      const rawDb: unknown[] = Array.isArray(dbData.jobs) ? dbData.jobs : []
      const dbJobs = toListingJobs(rawDb, 'VERIFIED_JOB')
      const liveJobs = toLiveExternalJobs(liveData?.data, 'LIVE_JOB')
      const seen = new Set<string>()
      const combined = [...liveJobs, ...dbJobs].filter(j => {
        if (seen.has(j.id)) return false
        seen.add(j.id)
        return true
      })
      const liveIds = new Set(liveJobs.map(j => j.id))
      const liveShown = combined.filter(j => liveIds.has(j.id)).length
      // The server's totals already describe renderable rows only; subtract anything
      // this check dropped so the count still equals what can be displayed.
      const dropped = rawDb.length - dbJobs.length
      const c: Counts = dbData.counts || { all: 0, live: 0, verified: 0, archived: 0 }
      setJobs(combined)
      setTotal(Math.max(0, (Number(dbData.total) || dbJobs.length) - dropped) + liveShown)
      setTotalPages(Number(dbData.totalPages) || 1)
      setCounts({
        all: Math.max(0, c.all - dropped) + liveShown,
        live: c.live + liveShown,
        verified: c.verified,
        archived: c.archived,
      })
    }).finally(() => setLoading(false))
  }, [q, category, type, location, exp, status, page])

  const countFor = (id: string) =>
    id === 'all' ? counts.all : id === 'LIVE_JOB' ? counts.live : id === 'VERIFIED_JOB' ? counts.verified : counts.archived

  return (
    <div>
      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUS_TABS.map(t => {
          const activeTab = (status || 'all') === t.id
          return (
            <button key={t.id} onClick={() => { setFilter('status', t.id === 'all' ? '' : t.id) }}
              style={{
                padding: '7px 14px', borderRadius: 22, border: '1.5px solid',
                fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                borderColor: activeTab ? '#1847d4' : '#e2e8f0',
                background: activeTab ? '#1847d4' : '#fff',
                color: activeTab ? '#fff' : '#374151',
              }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 800, background: activeTab ? 'rgba(255,255,255,.2)' : '#f0f4ff', color: activeTab ? '#fff' : '#1847d4', padding: '1px 7px', borderRadius: 10 }}>
                {countFor(t.id).toLocaleString('en-IN')}
              </span>
            </button>
          )
        })}
      </div>

      {!failed && (
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
          Showing <strong style={{ color: '#0d1f4e' }}>{total}</strong> jobs
        </p>
      )}

      {loading ? (
        <JobsLoadingSkeleton />
      ) : failed ? (
        <div role="alert" style={{ padding: 40, textAlign: 'center', color: '#b45309' }}>
          We couldn&apos;t load jobs right now. Please refresh and try again.
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No jobs match your filters.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 24 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: page <= 1 ? '#cbd5e1' : '#1847d4', fontWeight: 700, fontSize: 13, cursor: page <= 1 ? 'default' : 'pointer' }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: page >= totalPages ? '#cbd5e1' : '#1847d4', fontWeight: 700, fontSize: 13, cursor: page >= totalPages ? 'default' : 'pointer' }}>
            Next →
          </button>
        </div>
      )}

      <SourceDisclaimer />
    </div>
  )
}
