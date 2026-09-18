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
import { buildJobContent } from '@/lib/seo/jobContent'
import { describeSalary } from '@/lib/seo/salary'
import { isIndexable } from '@/lib/jobs/provenance'
import { incrementJobViews } from '@/lib/services/jobViews'

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
  return buildPageMetadata({
    title: `${job.title} at ${job.company} — Work From Home Jobs India`,
    description: `Apply for ${job.title} (${job.cat}) — a remote work-from-home role at ${job.company}. Salary ${job.salary}. Eligibility, skills, salary, benefits, how to apply & FAQs on Noble Job.`,
    path: `/jobs/wfh/${id}`,
    keywords: ['Work From Home Jobs', 'WFH Jobs', 'remote jobs India', job.company, job.cat, job.title],
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

  const content = buildJobContent({
    board: 'wfh',
    title: job.title,
    company: job.company,
    category: job.cat,
    location: 'Remote',
    salary: job.salary,
    experience: job.experience,
    qualification: job.qualification,
    employmentType: job.type || 'Full Time Remote',
    skills: job.skills,
    description: job.description,
    postedAt: job.posted_at,
    remote: true,
  })

  const [allWfh, govt, priv] = await Promise.all([
    getWfhJobs(),
    getGovtJobs('latest'),
    getJobs({ limit: 5 }),
  ])

  const pool = allWfh.filter(j => j.id !== job.id)
  const related: JobLink[] = [...pool.filter(j => j.cat === job.cat), ...pool.filter(j => j.cat !== job.cat)]
    .slice(0, 6)
    .map(j => ({ href: `/jobs/wfh/${j.id}`, title: `${j.title} — ${j.company}`, meta: `${j.cat} · ${j.salary}` }))

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

  const salaryBadge = content.parsedSalary ? describeSalary(content.parsedSalary) : job.salary

  return (
    <JobDetailTemplate
      accent={job.color || '#7c3aed'}
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Work From Home Jobs', href: '/jobs/wfh' },
        { label: job.title },
      ]}
      title={job.title}
      subtitle={`${job.company} · ${job.cat} · Remote (Work From Home)`}
      badges={['🏠 Work From Home', `💼 ${job.type || 'Full Time'}`, `💰 ${salaryBadge}`, `🎓 ${job.qualification || 'Any Graduate'}`, `📅 ${job.experience || 'Freshers'}`]}
      content={content}
      jsonLdSlot={<WfhJobJsonLd job={job} content={content} />}
      applySlot={<ApplyButton jobId={job.id} board="wfh" title={job.title} company={job.company} salary={job.salary} applyUrl={job.apply_url} />}
      actionsSlot={<JobActionBar board="wfh" jobId={job.id} jobTitle={job.title} />}
      internalLinks={{
        list: { href: '/jobs/wfh', label: 'All Work From Home Jobs' },
        category: { href: '/work-from-home-jobs', label: 'Work From Home Jobs Guide' },
        extra: [
          { href: '/jobs/wfh', label: `More ${job.cat} Remote Jobs` },
          { href: '/private-jobs', label: 'Private Jobs in India' },
          { href: '/upload-resume', label: 'Free Resume Analyzer' },
        ],
      }}
      relatedTitle="Related WFH Jobs"
      relatedJobs={related}
      govtSuggestions={govtSuggestions}
      privateSuggestions={privateSuggestions}
    />
  )
}
