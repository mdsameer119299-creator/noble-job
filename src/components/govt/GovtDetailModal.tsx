'use client'

import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import type { GovtJob } from '@/types/govtJob'
import { buildGovtJobLinkButtons } from '@/lib/services/govtOfficialLinks'
import { GovtHowToApply } from '@/components/govt/GovtHowToApply'

interface GovtDetailModalProps {
  job: GovtJob | null
  open: boolean
  onClose: () => void
}

export function GovtDetailModal({ job, open, onClose }: GovtDetailModalProps) {
  if (!job) return null

  const rows = [
    { l: 'Organisation', v: job.org },
    { l: 'Post', v: job.post },
    { l: 'Vacancies', v: job.vacancies },
    { l: 'Qualification', v: job.qualification },
    { l: 'Age Range', v: job.ageRange || job.age_range },
    { l: 'Application Fee', v: job.fee },
    { l: 'Last Date', v: job.lastDate || job.last_date },
    { l: 'Salary/Pay', v: job.salary },
    { l: 'Location', v: job.location },
    { l: 'Exam Date', v: job.examDate || job.exam_date || 'TBA' },
    { l: 'Start Date', v: job.startDate || job.start_date || 'TBA' },
  ]

  const links = buildGovtJobLinkButtons(job)
  const detailHref = `/jobs/govt/${job.slug || job.id}`

  return (
    <Modal open={open} onClose={onClose} maxWidth="700px" className="max-h-[90vh] overflow-y-auto">
      <div style={{ background: `linear-gradient(135deg,${job.color || '#1847d4'},#0d1f4e)`, padding: '26px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,.15)', padding: '3px 12px', borderRadius: 18, fontSize: 12, color: '#e0e8ff', fontWeight: 600, marginBottom: 10 }}>{job.org}</div>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{job.title}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ l: '👤 ' + job.vacancies + ' Vacancies' }, { l: '📅 Last Date: ' + (job.lastDate || job.last_date) }, { l: '💰 ' + job.salary }].map((t, i) => (
            <span key={i} style={{ background: 'rgba(255,255,255,.15)', padding: '4px 12px', borderRadius: 16, fontSize: 12.5, color: '#fff', fontWeight: 600 }}>{t.l}</span>
          ))}
        </div>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {rows.filter(r => r.v).map((r, i) => (
            <div key={i} style={{ background: '#f8faff', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{r.l}</div>
              <div style={{ fontWeight: 700, color: '#0d1f4e', fontSize: 13.5 }}>{r.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <GovtHowToApply job={job} />
        </div>

        {links.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontWeight: 800, color: '#0d1f4e', marginBottom: 12 }}>Important Links</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map((lk, i) => (
                <a
                  key={`${lk.l}-${i}`}
                  href={lk.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: lk.primary ? '#1847d4' : '#eff6ff',
                    color: lk.primary ? '#fff' : '#1847d4',
                    border: lk.primary ? 'none' : '1px solid #bfdbfe',
                    padding: '10px 16px',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13.5,
                    textDecoration: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  {lk.l}<span>→</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <Link
          href={detailHref}
          onClick={onClose}
          style={{
            display: 'block',
            textAlign: 'center',
            marginBottom: 16,
            color: '#1847d4',
            fontWeight: 800,
            fontSize: 13.5,
            textDecoration: 'none',
          }}
        >
          View full notification page →
        </Link>

        <div style={{ background: '#fffbeb', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#92400e', border: '1px solid #fcd34d' }}>
          ⚠️ Always check the official notification before applying. Noble Job is not responsible for any changes in dates or vacancies.
        </div>
      </div>
    </Modal>
  )
}
