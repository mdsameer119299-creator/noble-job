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
import { originalPostingDate } from '@/lib/seo/postingDate'
import { buildJobContent } from '@/lib/seo/jobContent'
import { detectCityLink } from '@/lib/seo/jobLinks'
import { classifyProvenance, isIndexable } from '@/lib/jobs/provenance'
import { toRelatedLinks } from '@/lib/seo/relatedLinks'
import { incrementJobViews } from '@/lib/services/jobViews'
import { displayValue, isRealDisplayValue, joinReal } from '@/lib/jobs/renderable'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getJobById(id)
  if (!job) {
    return buildPageMetadata({
      title: 'Job Not Found — Noble Job',
      description: 'This private job listing could not be found on Noble Job. Browse current private job openings across India.',
      path: `/jobs/private/${id}`,
      noIndex: true,
    })
  }
  const salary = displayValue(job.salary || formatSalary((job as { salary_min?: number }).salary_min, (job as { salary_max?: number }).salary_max))
  return buildPageMetadata({
    title: `${job.title} at ${job.company} in ${job.location} — Private Jobs India`,
    description: `Apply for ${job.title} at ${job.company}, ${job.location}.${salary ? ` Salary ${salary}.` : ''} Full job description, responsibilities, eligibility, skills, benefits, how to apply & FAQs on Noble Job.`,
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
  void incrementJobViews('private', id)

  const isSample = classifyProvenance(job) === 'SYNTHETIC'
  const fromIndexablePage = isIndexable(job)
  const row = job as typeof job & { salary_min?: number; salary_max?: number; posted_at?: string; application_deadline?: string | null; job_type?: string; experience_required?: string; description?: string }
  // Only a real stated salary is shown — never "Competitive"/"undefined" filler.
  const salary = displayValue(job.salary || formatSalary(row.salary_min, row.salary_max)) ?? ''
  const jobType = displayValue(row.job_type || job.type) ?? ''
  const experience = displayValue(row.experience_required || job.exp) ?? ''

  const content = buildJobContent({
    board: 'private',
    jobId: job.id,
    title: job.title,
    company: job.company,
    category: job.cat,
    location: job.location,
    salary,
    experience,
    employmentType: jobType,
    skills: job.skills,
    description: row.description || job.desc,
    // Stored posting timestamp only — `job.posted` is a display string, not a date.
    postedAt: row.posted_at,
    // The ORIGINAL source date (the one JobPosting datePosted uses) — shown so the schema date is visible.
    sourcePostedAt: originalPostingDate(job, 'private'),
    // The employer's real deadline only — never derived from the posting date.
    applicationDeadline: row.application_deadline ?? undefined,
    sample: isSample,
  })

  const [more, govt] = await Promise.all([
    getJobs({ limit: 30 }),
    getGovtJobs('latest'),
  ])

  const pool = more.jobs.filter(j => j.id !== job.id)
  // Genuine indexable pages only link to genuine indexable jobs (see relatedLinks).
  const related: JobLink[] = toRelatedLinks(
    'private',
    [...pool.filter(j => j.cat === job.cat), ...pool.filter(j => j.cat !== job.cat)],
    { fromIndexablePage, limit: 6 },
    (j, href) => ({ href, title: `${j.title} — ${j.company}`, meta: joinReal(j.location, j.salary) }),
  )

  const cityJobs = pool.filter(j => job.location && j.location?.includes(job.location.split(',')[0]))
  const govtSuggestions: JobLink[] = govt.slice(0, 5).map(g => ({
    href: `/jobs/govt/${(g as { slug?: string }).slug || g.id}`,
    title: g.title,
    meta: isRealDisplayValue(g.vacancies) ? `${g.org} · ${g.vacancies} posts` : g.org,
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
      subtitle={joinReal(job.company, job.location, jobType)}
      badges={[
        `🏢 ${job.company}`,
        `📍 ${job.location}`,
        salary ? `💰 ${salary}` : '',
        jobType ? `💼 ${jobType}` : '',
        experience ? `🧑‍💼 ${experience}` : '',
      ].filter(Boolean)}
      content={content}
      jsonLdSlot={<PrivateJobJsonLd job={job} content={content} />}
      applySlot={<ApplyButton jobId={job.id} applyUrl={row.apply_url || job.applyUrl} title={job.title} company={job.company} location={job.location} salary={salary} sample={isSample} />}
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
        links: toRelatedLinks(
          'private',
          cityJobs,
          { fromIndexablePage, limit: 5 },
          (j, href) => ({ href, title: `${j.title} — ${j.company}`, meta: joinReal(j.location, j.salary) }),
        ),
      } : undefined}
    />
  )
}
