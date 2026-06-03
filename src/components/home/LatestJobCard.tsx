import Link from 'next/link'

interface LatestJobCardProps { job: any; type: string }

export function LatestJobCard({ job, type }: LatestJobCardProps) {
  const href = type === "govt" ? `/jobs/govt/${job.id}` :
               type === "wfh" ? `/jobs/wfh/${job.id}` :
               type === "abroad" ? `/jobs/abroad/${job.id}` : `/jobs/private/${job.id}`

  const subtitle = type === "govt" ? `${job.vacancies || ""} Vacancies · ${job.location}` :
                   type === "wfh" ? `${job.company} · ${job.cat}` :
                   type === "abroad" ? `${job.company} · ${job.country}` :
                   `${job.location || "India"} · ${job.job_type || "Full Time"}`

  return (
    <Link href={href} style={{ display: 'block', padding: '10px 18px', borderBottom: '1px solid #f0f4ff', textDecoration: 'none', transition: 'background .15s' }}
      className="hover:bg-blue-50">
      <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0d1f4e', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {job.title}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
    </Link>
  )
}
