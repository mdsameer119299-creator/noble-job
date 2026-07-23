import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAbroadJobById, getAbroadJobs } from '@/lib/services/abroadJobService'
import { getGovtJobs } from '@/lib/services/govtJobService'
import { getJobs } from '@/lib/services/jobService'
import { AbroadJobJsonLd } from '@/components/seo/AbroadJobJsonLd'
import { JobDetailTemplate, type JobLink } from '@/components/jobs/JobDetailTemplate'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { buildJobContent } from '@/lib/seo/jobContent'
import { isIndexable } from '@/lib/jobs/provenance'
import { AbroadApplySlot } from '@/components/abroad/AbroadApplySlot'
import { JobActionBar } from '@/components/jobs/JobActionBar'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getAbroadJobById(id)
  if (!job) return { title: 'Abroad Job Not Found — Noble Job' }
  return buildPageMetadata({
    title: `${job.title} in ${job.country} at ${job.company} — Abroad Jobs`,
    description: `Apply for ${job.title} at ${job.company} in ${job.location || job.country}. Salary ${job.salary}. Eligibility, skills, salary, benefits, visa guidance, how to apply & FAQs on Noble Job.`,
    path: `/jobs/abroad/${id}`,
    keywords: ['Abroad Jobs', 'overseas jobs India', `jobs in ${job.country}`, job.company, job.category, job.title],
    ogType: 'article',
    // Synthetic/demo or filled roles are browsable but must not be indexed.
    noIndex: !isIndexable(job),
  })
}

export default async function AbroadJobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getAbroadJobById(id)
  if (!job) notFound()

  const content = buildJobContent({
    board: 'abroad',
    title: job.title,
    company: job.company,
    category: job.category,
    location: `${job.location || job.country}${job.country && !job.location?.includes(job.country) ? `, ${job.country}` : ''}`,
    salary: job.salary,
    experience: job.experience,
    employmentType: job.type || 'Full Time',
    skills: job.skills,
    description: job.description,
    postedAt: job.posted_at,
  })

  const [allAbroad, govt, priv] = await Promise.all([
    getAbroadJobs(),
    getGovtJobs('latest'),
    getJobs({ limit: 5 }),
  ])

  const pool = allAbroad.filter(j => j.id !== job.id)
  const related: JobLink[] = [
    ...pool.filter(j => j.country === job.country || j.category === job.category),
    ...pool.filter(j => j.country !== job.country && j.category !== job.category),
  ].slice(0, 6).map(j => ({ href: `/jobs/abroad/${j.id}`, title: `${j.title} — ${j.company}`, meta: `${j.country} · ${j.salary}` }))

  const countryJobs = pool.filter(j => j.country === job.country).slice(0, 5)
  const govtSuggestions: JobLink[] = govt.slice(0, 5).map(g => ({
    href: `/jobs/govt/${(g as { slug?: string }).slug || g.id}`,
    title: g.title,
    meta: `${g.org} · ${g.vacancies} posts`,
  }))
  const privateSuggestions: JobLink[] = priv.jobs.slice(0, 5).map(p => ({
    href: `/jobs/private/${p.id}`,
    title: `${p.title} — ${p.company}`,
    meta: `${p.location} · ${p.salary}`,
  }))

  return (
    <JobDetailTemplate
      accent="#0369a1"
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Abroad Jobs', href: '/jobs/abroad' },
        { label: job.title },
      ]}
      title={job.title}
      subtitle={`${job.company} · ${job.location || job.country} · ${job.type || 'Full Time'}`}
      badges={[`🌍 ${job.country}`, `🏢 ${job.company}`, `💰 ${job.salary}`, `💼 ${job.type || 'Full Time'}`, `🧑‍💼 ${job.experience || 'Any'}`]}
      content={content}
      jsonLdSlot={<AbroadJobJsonLd job={job} content={content} />}
      applySlot={<AbroadApplySlot job={job} />}
      actionsSlot={<JobActionBar board="abroad" jobId={job.id} jobTitle={job.title} />}
      internalLinks={{
        list: { href: '/jobs-abroad', label: 'Jobs Abroad Guide' },
        category: { href: '/jobs/abroad', label: `More Jobs in ${job.country}` },
        extra: [
          { href: '/jobs/abroad', label: 'All Abroad Job Listings' },
          { href: '/private-jobs', label: 'Private Jobs in India' },
        ],
      }}
      relatedTitle="Related Abroad Jobs"
      relatedJobs={related}
      govtSuggestions={govtSuggestions}
      privateSuggestions={privateSuggestions}
      citySuggestions={countryJobs.length ? {
        title: `More Jobs in ${job.country}`,
        links: countryJobs.map(j => ({ href: `/jobs/abroad/${j.id}`, title: `${j.title} — ${j.company}`, meta: `${j.country} · ${j.salary}` })),
      } : undefined}
    />
  )
}
