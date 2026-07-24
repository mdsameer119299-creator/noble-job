import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getJobById, getJobs } from '@/lib/services/jobService'
import { getGovtJobs } from '@/lib/services/govtJobService'
import { formatSalary } from '@/lib/utils/formatters'
import { ApplyButton } from '@/components/jobs/ApplyButton'
import { JobActionBar } from '@/components/jobs/JobActionBar'
import { PrivateJobJsonLd } from '@/components/seo/PrivateJobJsonLd'
import { JobDetailTemplate, type JobLink } from '@/components/jobs/JobDetailTemplate'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { buildJobContent } from '@/lib/seo/jobContent'
import { detectCityLink } from '@/lib/seo/jobLinks'
import { isIndexable } from '@/lib/jobs/provenance'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getJobById(id)
  if (!job) return { title: 'Job Not Found — Noble Job', robots: { index: false, follow: false } }
  const salary = job.salary || formatSalary((job as { salary_min?: number }).salary_min, (job as { salary_max?: number }).salary_max)
  return buildPageMetadata({
    title: `${job.title} at ${job.company} in ${job.location} — Private Jobs India`,
    description: `Apply for ${job.title} at ${job.company}, ${job.location}. Salary ${salary}. Full job description, responsibilities, eligibility, skills, benefits, how to apply & FAQs on Noble Job.`,
    path: `/jobs/private/${id}`,
    keywords: ['Private Jobs', job.company, job.location, job.cat, job.title, 'Jobs in India'],
    ogType: 'article',
    // Synthetic/demo or filled roles are browsable but must not be indexed.
    noIndex: !isIndexable(job),
  })
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getJobById(id)
  if (!job) notFound()

  const row = job as typeof job & { salary_min?: number; salary_max?: number; posted_at?: string; job_type?: string; experience_required?: string; description?: string }
  const salary = job.salary || formatSalary(row.salary_min, row.salary_max)

  const content = buildJobContent({
    board: 'private',
    title: job.title,
    company: job.company,
    category: job.cat,
    location: job.location,
    salary,
    experience: row.experience_required || job.exp,
    employmentType: row.job_type || job.type || 'Full Time',
    skills: job.skills,
    description: row.description || job.desc,
    postedAt: row.posted_at || job.posted,
  })

  const [more, govt] = await Promise.all([
    getJobs({ limit: 30 }),
    getGovtJobs('latest'),
  ])

  const pool = more.jobs.filter(j => j.id !== job.id)
  const related: JobLink[] = [...pool.filter(j => j.cat === job.cat), ...pool.filter(j => j.cat !== job.cat)]
    .slice(0, 6)
    .map(j => ({ href: `/jobs/private/${j.id}`, title: `${j.title} — ${j.company}`, meta: `${j.location} · ${j.salary}` }))

  const cityJobs = pool.filter(j => job.location && j.location?.includes(job.location.split(',')[0])).slice(0, 5)
  const govtSuggestions: JobLink[] = govt.slice(0, 5).map(g => ({
    href: `/jobs/govt/${(g as { slug?: string }).slug || g.id}`,
    title: g.title,
    meta: `${g.org} · ${g.vacancies} posts`,
  }))
  const privateSuggestions: JobLink[] = related.slice(0, 5)
  const cityLink = detectCityLink(job.location, 'private')

  return (
    <JobDetailTemplate
      accent={(job as { color?: string }).color || '#1847d4'}
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Private Jobs', href: '/jobs/private' },
        { label: job.title },
      ]}
      title={job.title}
      subtitle={`${job.company} · ${job.location} · ${row.job_type || job.type || 'Full Time'}`}
      badges={[`🏢 ${job.company}`, `📍 ${job.location}`, `💰 ${salary}`, `💼 ${row.job_type || job.type || 'Full Time'}`, `🧑‍💼 ${row.experience_required || job.exp || 'Any'}`]}
      content={content}
      jsonLdSlot={<PrivateJobJsonLd job={job} content={content} />}
      applySlot={<ApplyButton jobId={job.id} applyUrl={row.apply_url || job.applyUrl} title={job.title} company={job.company} location={job.location} salary={salary} />}
      actionsSlot={<JobActionBar board="private" jobId={job.id} jobTitle={job.title} />}
      internalLinks={{
        list: { href: '/private-jobs', label: 'Private Jobs in India' },
        category: { href: `/jobs/private?category=${encodeURIComponent(job.cat || '')}`, label: `More ${job.cat || 'Private'} Jobs` },
        city: cityLink,
        extra: [
          { href: '/jobs/private', label: 'All Private Job Listings' },
          { href: '/fresher-jobs', label: 'Fresher Jobs' },
          { href: '/work-from-home-jobs', label: 'Work From Home Jobs' },
        ],
      }}
      relatedTitle="Related Private Jobs"
      relatedJobs={related}
      govtSuggestions={govtSuggestions}
      privateSuggestions={privateSuggestions}
      citySuggestions={cityLink ? {
        title: cityLink.label,
        links: cityJobs.map(j => ({ href: `/jobs/private/${j.id}`, title: `${j.title} — ${j.company}`, meta: `${j.location} · ${j.salary}` })),
      } : undefined}
    />
  )
}
