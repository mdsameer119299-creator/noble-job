'use client'
import { Modal } from '@/components/ui/Modal'
import type { Job } from '@/types/job'
import { formatSalary, formatDate } from '@/lib/utils/formatters'
import { applyStateFor } from '@/lib/jobs/applyRoute'
import { ApplyButton } from './ApplyButton'
import { displayValue } from '@/lib/jobs/renderable'

interface JobDetailModalProps { job: Job | null; open: boolean; onClose: () => void }

export function JobDetailModal({ job, open, onClose }: JobDetailModalProps) {
  if (!job) return null
  return (
    <Modal open={open} onClose={onClose} maxWidth="700px">
      <div style={{ background: `linear-gradient(135deg,${job.color || '#1847d4'},#0d1f4e)`, padding: '32px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{job.cat || job.category}</div>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{job.title}</h2>
        <div style={{ color: 'rgba(255,255,255,.8)', marginBottom: 16 }}>{[job.company, displayValue(job.type || job.job_type)].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[displayValue(job.salary || formatSalary((job as any).salary_min, (job as any).salary_max)), displayValue(job.exp || (job as any).experience_required), displayValue(job.location), formatDate((job as any).posted_at || job.posted || '')].filter(Boolean).map((v, i) => (
            <span key={i} style={{ background: 'rgba(255,255,255,.15)', padding: '5px 12px', borderRadius: 18, fontSize: 12.5, color: '#fff', fontWeight: 600 }}>{v}</span>
          ))}
        </div>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <p style={{ color: '#374151', lineHeight: 1.75, marginBottom: 20 }}>{job.desc || job.description}</p>
        {job.skills?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontWeight: 800, color: '#0d1f4e', marginBottom: 10 }}>Required Skills</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {job.skills.map(s => <span key={s} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '5px 12px', borderRadius: 18, fontSize: 13, fontWeight: 600 }}>{s}</span>)}
            </div>
          </div>
        )}
        {/* The honest apply state: on-site flow only for an employer-delivered job, a source link
            only for a genuine external URL, and NO apply control otherwise (never a "#" link). */}
        <ApplyButton jobId={job.id} board="private" state={applyStateFor('private', job, job.company)} title={job.title} company={job.company} location={job.location} salary={job.salary} block />
      </div>
    </Modal>
  )
}
