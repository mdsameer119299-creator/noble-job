'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import type { Application, ApplicationStatus } from '@/types/application'
import { applicationJobTitle } from '@/lib/utils/applicationDisplay'
import { ScheduleInterviewModal } from './ScheduleInterviewModal'

const TABS: { id: ApplicationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interview' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
]

type Board = 'private' | 'wfh' | 'abroad'
const BOARD_FILTERS: { id: Board | 'all'; label: string }[] = [
  { id: 'all', label: 'All Boards' },
  { id: 'private', label: 'Private' },
  { id: 'wfh', label: 'Work From Home' },
  { id: 'abroad', label: 'Abroad' },
]
const BOARD_LABEL: Record<Board, string> = { private: 'Private', wfh: 'WFH', abroad: 'Abroad' }

const NEXT_STATUS: ApplicationStatus[] = ['shortlisted', 'interview', 'hired', 'rejected']

// Application rows carry these columns via getApplicationsByEmployer (select '*').
type Row = Application & { candidate_id?: string; employer_id?: string }

export function AppStatusTabs() {
  const [tab, setTab] = useState<ApplicationStatus | 'all'>('all')
  const [board, setBoard] = useState<Board | 'all'>('all')
  const [apps, setApps] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [resumeBusy, setResumeBusy] = useState<string | null>(null)
  const [interview, setInterview] = useState<Row | null>(null)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('status', tab)
    if (board !== 'all') params.set('board', board)
    const q = params.toString() ? `?${params.toString()}` : ''
    fetch(`/api/applications/employer${q}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setApps(d.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab, board]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success(`Marked as ${status}`); load() }
    else toast.error('Update failed')
  }

  const viewResume = async (appId: string) => {
    setResumeBusy(appId)
    try {
      const res = await fetch(`/api/employer/applications/${appId}/resume-url`)
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer')
      else toast.error(d.error || 'Resume not available')
    } finally { setResumeBusy(null) }
  }

  const candidateName = (app: Row) =>
    `${(app.candidate as { first_name?: string })?.first_name ?? ''} ${(app.candidate as { last_name?: string })?.last_name ?? ''}`.trim()

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {BOARD_FILTERS.map(b => (
          <button key={b.id} type="button" onClick={() => setBoard(b.id)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid', borderColor: board === b.id ? '#0d1f4e' : '#e2e8f0', background: board === b.id ? '#0d1f4e' : '#fff', color: board === b.id ? '#fff' : '#374151', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            {b.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid', borderColor: tab === t.id ? '#1847d4' : '#e2e8f0', background: tab === t.id ? '#eff6ff' : '#fff', color: tab === t.id ? '#1847d4' : '#374151', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading applications…</p>
      ) : error ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 20 }}>
          <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load applications.</p>
          <button type="button" onClick={load} style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Retry</button>
        </div>
      ) : apps.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No applications in this tab.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {apps.map(app => (
            <div key={app.id} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0d1f4e' }}>{applicationJobTitle(app)}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#1847d4', background: '#eff6ff', padding: '2px 8px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    {BOARD_LABEL[(app.board as Board) || 'private']}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  {candidateName(app) || 'Candidate'} · {app.status}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(app.candidate as { has_resume?: boolean })?.has_resume && (
                  <button type="button" onClick={() => viewResume(app.id)} disabled={resumeBusy === app.id}
                    style={action('#1847d4', '#eff6ff', '#bfdbfe')}>
                    {resumeBusy === app.id ? '…' : '📄 Résumé'}
                  </button>
                )}
                <button type="button" onClick={() => setInterview(app)} style={action('#7c3aed', '#f5f3ff', '#ddd6fe')}>📅 Interview</button>
                {NEXT_STATUS.filter(s => s !== app.status).map(s => (
                  <button key={s} type="button" onClick={() => updateStatus(app.id, s)} style={action('#374151', '#f8faff', '#e2e8f0')}>→ {s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {interview && interview.candidate_id && interview.employer_id && (
        <ScheduleInterviewModal
          open={!!interview}
          onClose={() => setInterview(null)}
          applicationId={interview.id}
          candidateId={interview.candidate_id}
          employerId={interview.employer_id}
          candidateName={candidateName(interview)}
          onScheduled={() => { setInterview(null); load() }}
        />
      )}
    </div>
  )
}

const action = (color: string, bg: string, border: string): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, background: bg, color, fontSize: 11, fontWeight: 700, cursor: 'pointer',
})
