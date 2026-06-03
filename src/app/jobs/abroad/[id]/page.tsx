import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAbroadJobById } from '@/lib/services/abroadJobService'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'
import { AbroadJobJsonLd } from '@/components/seo/AbroadJobJsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getAbroadJobById(id)
  if (!job) return { title: 'Abroad Job Not Found — Noble Job' }
  return buildPageMetadata({
    title: `${job.title} in ${job.country} — Abroad Jobs | Noble Job`,
    description: `Apply for ${job.title} at ${job.company} in ${job.country}. Salary: ${job.salary}. International career opportunity on Noble Job.`,
    path: `/jobs/abroad/${id}`,
    keywords: ['Abroad Jobs', job.country, job.company, job.category, 'overseas jobs India'],
    ogType: 'article',
  })
}

export default async function AbroadJobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getAbroadJobById(id)
  if (!job) notFound()

  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <AbroadJobJsonLd job={job} />
      <div style={{ background: 'linear-gradient(135deg,#0369a1,#0d1f4e)', padding: '32px 0' }}>
        <div className="wrap">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Abroad Jobs', href: '/jobs/abroad' },
              { label: job.title },
            ]}
          />
          <h1 style={{ fontFamily: 'Playfair Display,serif', fontSize: 30, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{job.title}</h1>
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 15 }}>{job.company} · {job.country} · {job.salary}</p>
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
            <a href={job.apply_url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: 'linear-gradient(135deg,#0369a1,#0d1f4e)', color: '#fff', padding: '13px', borderRadius: 10, fontWeight: 900, textDecoration: 'none', textAlign: 'center', fontSize: 15 }}>Apply on Official Site →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
