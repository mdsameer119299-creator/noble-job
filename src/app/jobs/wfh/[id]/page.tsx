import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWfhJobById, getWfhJobs } from '@/lib/services/wfhJobService'
import { getGovtJobs } from '@/lib/services/govtJobService'
import { getJobs } from '@/lib/services/jobService'
import { ApplyButton } from '@/components/jobs/ApplyButton'
import { JobActionBar } from '@/components/jobs/JobActionBar'
import { WfhJobJsonLd } from '@/components/seo/WfhJobJsonLd'
import { JobDetailTemplate, type JobLink } from '@/components/jobs/JobDetailTemplate'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { originalPostingDate } from '@/lib/seo/postingDate'
import { countryDisplayName, resolveApplicantCountry } from '@/lib/seo/jobPostingRules'
import { buildJobContent } from '@/lib/seo/jobContent'
import { describeSalary } from '@/lib/seo/salary'
import { classifyProvenance, isIndexable } from '@/lib/jobs/provenance'
import { toRelatedLinks } from '@/lib/seo/relatedLinks'
import { incrementJobViews } from '@/lib/services/jobViews'
import { displayValue, isRealDisplayValue, joinReal } from '@/lib/jobs/renderable'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getWfhJobById(id)
  if (!job) {
    return buildPageMetadata({
      title: 'WFH Job Not Found — Noble Job',
      description: 'This work-from-home job listing could not be found on Noble Job. Browse current remote job openings.',
      path: `/jobs/wfh/${id}`,
      noIndex: true,
    })
  }
  const metaSalary = displayValue(job.salary)
  const metaCat = displayValue(job.cat)
  return buildPageMetadata({
    title: `${job.title} at ${job.company} — Work From Home Jobs India`,
    description: `Apply for ${job.title}${metaCat ? ` (${metaCat})` : ''} — a remote work-from-home role at ${job.company}.${metaSalary ? ` Salary ${metaSalary}.` : ''} Eligibility, skills, salary, benefits, how to apply & FAQs on Noble Job.`,
    path: `/jobs/wfh/${id}`,
    keywords: ['Work From Home Jobs', 'WFH Jobs', 'remote jobs India', job.company, job.cat, job.title].filter(isRealDisplayValue),
    ogType: 'article',
    // Synthetic/demo or filled roles are browsable but must not be indexed.
    noIndex: !isIndexable(job),
  })
}

export default async function WfhJobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getWfhJobById(id)
  if (!job) notFound()
  void incrementJobViews('wfh', id)
  const isSample = classifyProvenance(job) === 'SYNTHETIC'
  const fromIndexablePage = isIndexable(job)

  const content = buildJobContent({
    board: 'wfh',
    jobId: job.id,
    title: job.title,
    company: job.company,
    category: job.cat,
    location: 'Remote',
    salary: displayValue(job.salary) ?? '',
    experience: displayValue(job.experience) ?? '',
    qualification: displayValue(job.qualification) ?? '',
    employmentType: displayValue(job.type) || 'Full Time Remote',
    skills: job.skills,
    description: job.description,
    postedAt: job.posted_at,
    sourcePostedAt: originalPostingDate(job, 'wfh'),
    applicationDeadline: (job as { application_deadline?: string | null }).application_deadline ?? undefined,
    sample: isSample,
    remote: true,
  })

  const [allWfh, govt, priv] = await Promise.all([
    getWfhJobs(),
    getGovtJobs('latest'),
    getJobs({ limit: 5 }),
  ])

  const pool = allWfh.filter(j => j.id !== job.id)
  const related: JobLink[] = toRelatedLinks(
    'wfh',
    [...pool.filter(j => j.cat === job.cat), ...pool.filter(j => j.cat !== job.cat)],
    { fromIndexablePage, limit: 6 },
    (j, href) => ({ href, title: `${j.title} — ${j.company}`, meta: joinReal(j.cat, j.salary) }),
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

  const salaryBadge = content.parsedSalary ? describeSalary(content.parsedSalary) : displayValue(job.salary)
  // The permitted country JobPosting.applicantLocationRequirements is built from must be
  // visible: shown whenever the record STATES it (stored field or its own text), never assumed.
  const applicantCountry = countryDisplayName(
    resolveApplicantCountry((job as { applicant_country?: string | null }).applicant_country, job.type, job.title, job.description),
  )

  return (
    <JobDetailTemplate
      accent={job.color || '#7c3aed'}
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Work From Home Jobs', href: '/jobs/wfh' },
        { label: job.title },
      ]}
      title={job.title}
      subtitle={joinReal(job.company, job.cat, 'Remote (Work From Home)')}
      badges={[
        '🏠 Work From Home',
        applicantCountry ? `🌏 Open to candidates in ${applicantCountry}` : '',
        displayValue(job.type) ? `💼 ${displayValue(job.type)}` : '',
        salaryBadge ? `💰 ${salaryBadge}` : '',
        displayValue(job.qualification) ? `🎓 ${displayValue(job.qualification)}` : '',
        displayValue(job.experience) ? `📅 ${displayValue(job.experience)}` : '',
      ].filter(Boolean)}
      content={content}
      jsonLdSlot={<WfhJobJsonLd job={job} content={content} />}
      applySlot={<ApplyButton jobId={job.id} board="wfh" title={job.title} company={job.company} salary={job.salary} applyUrl={job.apply_url} sample={isSample} />}
      actionsSlot={<JobActionBar board="wfh" jobId={job.id} jobTitle={job.title} />}
      internalLinks={{
        list: { href: '/jobs/wfh', label: 'All Work From Home Jobs' },
        category: { href: '/work-from-home-jobs', label: 'Work From Home Jobs Guide' },
        extra: [
          { href: '/jobs/wfh', label: `More ${job.cat} Remote Jobs` },
          { href: '/private-jobs', label: 'Private Jobs in India' },
        ],
      }}
      relatedTitle="Related WFH Jobs"
      relatedJobs={related}
      govtSuggestions={govtSuggestions}
      privateSuggestions={privateSuggestions}
    />
  )
}
