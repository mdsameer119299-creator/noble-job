'use client'
import { useEffect, useRef, useState } from 'react'
import { JobCard } from './JobCard'
import { JobsLoadingSkeleton } from './JobsLoadingSkeleton'
import { SourceDisclaimer } from './SourceDisclaimer'
import { useJobFilters } from '@/hooks/useJobFilters'
import { mergePrivateListing } from '@/lib/jobs/mergePrivateListing'
import type { Job } from '@/types/job'

type Counts = { all: number; live: number; verified: number; archived: number }

const STATUS_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Jobs' },
  { id: 'LIVE_JOB', label: 'Live Jobs' },
  { id: 'VERIFIED_JOB', label: 'Verified Jobs' },
  { id: 'ARCHIVED_JOB', label: 'Archived Jobs' },
]

export interface InitialJobData {
  jobs: Job[]
  total: number
  totalPages: number
  counts: Counts
  /** The page number the server rendered; the first client fetch is skipped only for this exact, unfiltered view. */
  page: number
}

export function LiveJobsList({ initialData }: { initialData?: InitialJobData } = {}) {
  const { q, category, type, location, exp, status, page, setFilter, setPage } = useJobFilters()
  const [jobs, setJobs] = useState<Job[]>(initialData?.jobs ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [failed, setFailed] = useState(false)
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages ?? 1)
  const [counts, setCounts] = useState<Counts>(initialData?.counts ?? { all: 0, live: 0, verified: 0, archived: 0 })

  // The server already rendered this exact view (unfiltered, same page) with the same merge the
  // client uses — refetching on mount would only flash the real list back to "Loading…".
  const serverRendered = useRef(!!initialData)
  const isServerView =
    !q && (!category || category === 'all') && (!type || type === 'all') && !location && !exp &&
    (!status || status === 'all') && page === initialData?.page

  useEffect(() => {
    if (serverRendered.current) {
      serverRendered.current = false
      if (isServerView) return
    }
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
      const merged = mergePrivateListing(dbData, liveData?.data)
      setJobs(merged.jobs)
      setTotal(merged.total)
      setTotalPages(merged.totalPages)
      setCounts(merged.counts)
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
