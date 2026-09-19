import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAbroadJobById, getAbroadJobs } from '@/lib/services/abroadJobService'
import { getGovtJobs } from '@/lib/services/govtJobService'
import { getJobs } from '@/lib/services/jobService'
import { AbroadJobJsonLd } from '@/components/seo/AbroadJobJsonLd'
import { JobDetailTemplate, type JobLink } from '@/components/jobs/JobDetailTemplate'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { buildJobContent } from '@/lib/seo/jobContent'
import { classifyProvenance, isIndexable } from '@/lib/jobs/provenance'
import { toRelatedLinks } from '@/lib/seo/relatedLinks'
import { incrementJobViews } from '@/lib/services/jobViews'
import { displayValue, isRealDisplayValue, joinReal } from '@/lib/jobs/renderable'
import { AbroadApplySlot } from '@/components/abroad/AbroadApplySlot'
import { JobActionBar } from '@/components/jobs/JobActionBar'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getAbroadJobById(id)
  if (!job) {
    return buildPageMetadata({
      title: 'Abroad Job Not Found — Noble Job',
      description: 'This abroad job listing could not be found on Noble Job. Browse current overseas job openings.',
      path: `/jobs/abroad/${id}`,
      noIndex: true,
    })
  }
  const metaSalary = displayValue(job.salary)
  return buildPageMetadata({
    title: `${job.title} in ${job.country} at ${job.company} — Abroad Jobs`,
    description: `Apply for ${job.title} at ${job.company} in ${displayValue(job.location) || job.country}.${metaSalary ? ` Salary ${metaSalary}.` : ''} Eligibility, skills, salary, benefits, visa guidance, how to apply & FAQs on Noble Job.`,
    path: `/jobs/abroad/${id}`,
    keywords: ['Abroad Jobs', 'overseas jobs India', `jobs in ${job.country}`, job.company, job.category, job.title].filter(isRealDisplayValue),
    ogType: 'article',
    // Synthetic/demo or filled roles are browsable but must not be indexed.
    noIndex: !isIndexable(job),
  })
}

export default async function AbroadJobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getAbroadJobById(id)
  if (!job) notFound()
  void incrementJobViews('abroad', id)
  const isSample = classifyProvenance(job) === 'SYNTHETIC'
  const fromIndexablePage = isIndexable(job)

  const content = buildJobContent({
    board: 'abroad',
    title: job.title,
    company: job.company,
    category: job.category,
    location: `${displayValue(job.location) || job.country}${job.country && !displayValue(job.location)?.includes(job.country) && displayValue(job.location) ? `, ${job.country}` : ''}`,
    salary: displayValue(job.salary) ?? '',
    experience: displayValue(job.experience) ?? '',
    employmentType: displayValue(job.type) ?? '',
    skills: job.skills,
    description: job.description,
    postedAt: job.posted_at,
    applicationDeadline: (job as { application_deadline?: string | null }).application_deadline ?? undefined,
    sample: isSample,
  })

  const [allAbroad, govt, priv] = await Promise.all([
    getAbroadJobs(),
    getGovtJobs('latest'),
    getJobs({ limit: 5 }),
  ])

  const pool = allAbroad.filter(j => j.id !== job.id)
  const related: JobLink[] = toRelatedLinks(
    'abroad',
    [
      ...pool.filter(j => j.country === job.country || j.category === job.category),
      ...pool.filter(j => j.country !== job.country && j.category !== job.category),
    ],
    { fromIndexablePage, limit: 6 },
    (j, href) => ({ href, title: `${j.title} — ${j.company}`, meta: joinReal(j.country, j.salary) }),
  )

  const countryJobs = pool.filter(j => j.country === job.country)
  const countryLinks: JobLink[] = toRelatedLinks(
    'abroad',
    countryJobs,
    { fromIndexablePage, limit: 5 },
    (j, href) => ({ href, title: `${j.title} — ${j.company}`, meta: joinReal(j.country, j.salary) }),
  )
  const govtSuggestions: JobLink[] = govt.slice(0, 5).map(g => ({
    href: `/jobs/govt/${(g as { slug?: string }).slug || g.id}`,
    title: g.title,
    meta: isRealDisplayValue(g.vacancies) ? `${g.org} · ${g.vacancies} posts` : g.org,
  }))
  const privateSuggestions: JobLink[] = toRelatedLinks(
    'private',
    priv.jobs,
    { fromIndexablePage, limit: 5 },
    (p, href) => ({ href, title: `${p.title} — ${p.company}`, meta: joinReal(p.location, p.salary) }),
  )

  return (
    <JobDetailTemplate
      accent="#0369a1"
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Abroad Jobs', href: '/jobs/abroad' },
        { label: job.title },
      ]}
      title={job.title}
      subtitle={joinReal(job.company, job.location || job.country, job.type)}
      badges={[
        `🌍 ${job.country}`,
        `🏢 ${job.company}`,
        displayValue(job.salary) ? `💰 ${displayValue(job.salary)}` : '',
        displayValue(job.type) ? `💼 ${displayValue(job.type)}` : '',
        displayValue(job.experience) ? `🧑‍💼 ${displayValue(job.experience)}` : '',
      ].filter(Boolean)}
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
      citySuggestions={countryLinks.length ? {
        title: `More Jobs in ${job.country}`,
        links: countryLinks,
      } : undefined}
    />
  )
}
