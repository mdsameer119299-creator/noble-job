import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWfhJobById } from '@/lib/services/wfhJobService'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'
import { WfhJobJsonLd } from '@/components/seo/WfhJobJsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getWfhJobById(id)
  if (!job) return { title: 'WFH Job Not Found — Noble Job' }
  return buildPageMetadata({
    title: `${job.title} at ${job.company} — Work From Home Jobs India`,
    description: `Apply for ${job.title} (${job.cat}) at ${job.company}. Salary: ${job.salary}. Remote WFH job on Noble Job — Job Portal India.`,
    path: `/jobs/wfh/${id}`,
    keywords: ['Work From Home Jobs', 'WFH Jobs', job.company, job.cat, 'Jobs in India'],
    ogType: 'article',
  })
}

export default async function WfhJobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getWfhJobById(id)
  if (!job) notFound()

  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <WfhJobJsonLd job={job} />
      <div style={{ background: `linear-gradient(135deg,${job.color || '#7c3aed'},#0d1f4e)`, padding: '32px 0' }}>
        <div className="wrap">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Work From Home', href: '/jobs/wfh' },
              { label: job.title },
            ]}
          />
          <h1 style={{ fontFamily: 'Playfair Display,serif', fontSize: 30, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{job.title}</h1>
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 16 }}>{job.company} · {job.cat} · {job.salary}</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 40 }}>
        <div className="jobs-layout-2col">
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px' }}>
            <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', marginBottom: 16 }}>Job Description</h2>
            <p style={{ color: '#374151', lineHeight: 1.8 }}>{job.description}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', marginBottom: 16 }}>Apply Now</h3>
            <a href={job.apply_url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: 'linear-gradient(135deg,#1847d4,#7c3aed)', color: '#fff', padding: '13px', borderRadius: 10, fontWeight: 900, textDecoration: 'none', textAlign: 'center', fontSize: 15 }}>Apply on Official Site →</a>
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>Noble Job never charges candidates</p>
          </div>
        </div>
      </div>
    </div>
  )
}
