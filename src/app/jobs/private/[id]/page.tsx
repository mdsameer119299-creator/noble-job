import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getJobById } from '@/lib/services/jobService'
import { formatSalary, formatDate } from '@/lib/utils/formatters'
import { ApplyButton } from '@/components/jobs/ApplyButton'
import { SaveJobButton } from '@/components/jobs/SaveJobButton'
import { EmailAlertForm } from '@/components/jobs/EmailAlertForm'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'
import { PrivateJobJsonLd } from '@/components/seo/PrivateJobJsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getJobById(id)
  if (!job) return { title: 'Job Not Found — Noble Job' }
  const salary = job.salary || formatSalary((job as any).salary_min, (job as any).salary_max)
  return buildPageMetadata({
    title: `${job.title} at ${job.company} — Private Jobs India`,
    description: `Apply for ${job.title} at ${job.company} in ${job.location}. Salary: ${salary}. Private Jobs on Noble Job — Job Portal India.`,
    path: `/jobs/private/${id}`,
    keywords: ['Private Jobs', job.company, job.location, 'Jobs in India'],
    ogType: 'article',
  })
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getJobById(id)
  if (!job) notFound()

  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <PrivateJobJsonLd job={job} />
      <div style={{ background: `linear-gradient(135deg,${(job as any).color || '#1847d4'},#0d1f4e)`, padding: '32px 0' }}>
        <div className="wrap">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Private Jobs', href: '/jobs/private' },
              { label: job.title },
            ]}
          />
          <div className="job-detail-hero-row">
            <div style={{ width: 64, height: 64, borderRadius: 14, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 22, flexShrink: 0 }}>
              {job.company?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontFamily: 'Playfair Display,serif', fontSize: 30, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{job.title}</h1>
              <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 16, marginBottom: 14 }}>{job.company} · {job.location}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  (job as any).job_type || 'Full Time',
                  (job as any).experience_required || job.exp || 'Any',
                  job.salary || formatSalary((job as any).salary_min, (job as any).salary_max),
                  formatDate((job as any).posted_at || ''),
                ].map((v, i) => <span key={i} style={{ background: 'rgba(255,255,255,.15)', padding: '5px 12px', borderRadius: 18, fontSize: 13, color: '#fff', fontWeight: 600 }}>{v}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 40 }}>
        <div className="jobs-layout-2col">
          <div>
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', marginBottom: 16 }}>Job Description</h2>
              <p style={{ color: '#374151', lineHeight: 1.8 }}>{(job as any).description || job.desc}</p>
            </div>
            {(job.skills || []).length > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px' }}>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', marginBottom: 14 }}>Required Skills</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {job.skills.map((s: string) => <span key={s} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{s}</span>)}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '24px' }}>
              <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', marginBottom: 16 }}>Apply for this Job</h3>
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <ApplyButton jobId={job.id} applyUrl={(job as any).apply_url || job.applyUrl} title={job.title} />
                <SaveJobButton jobId={job.id} board="private" />
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 12 }}>Noble Job never charges candidates</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '20px' }}>
              <h4 style={{ fontWeight: 800, color: '#0d1f4e', marginBottom: 12, fontSize: 14 }}>📬 Get Similar Job Alerts</h4>
              <EmailAlertForm board="private" placeholder="Your email" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
