import type { Metadata } from 'next'
import Link from 'next/link'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Post Jobs & Hire Candidates in India — For Employers | Noble Job',
  description:
    'Post jobs on Noble Job for free, manage applicants and search candidate profiles. A simple hiring dashboard for Indian employers.',
  path: '/for-employers',
  keywords: ['post a job India', 'hire candidates India', 'employer job posting', 'free job posting'],
})

const REGISTER_HREF = '/auth?role=employer&tab=register'

const BENEFITS = [
  { icon: '📝', title: 'Post a job in minutes', text: 'Create a listing from your employer dashboard — title, location, salary range and how to apply. Edit or close it whenever you like.' },
  { icon: '📥', title: 'Manage applicants in one place', text: 'See everyone who applied to each of your jobs, review their profiles and keep track of your shortlist from the dashboard.' },
  { icon: '🔎', title: 'Search candidate profiles', text: 'Find candidates by skills, experience and location instead of waiting for applications to arrive.' },
  { icon: '✅', title: 'Reviewed before going live', text: 'Our team reviews employer jobs before they appear, which keeps spam and misleading listings away from job seekers — and keeps your brand in good company.' },
]

const STEPS = [
  { n: '1', title: 'Create your free employer account', text: 'Sign up with your work email and add your company name, website and city.' },
  { n: '2', title: 'Post your first job', text: 'Describe the role and how candidates should apply. Your listing goes live once it has been reviewed.' },
  { n: '3', title: 'Review applications and find talent', text: 'Open your dashboard to see applicants and search the candidate pool for more matches.' },
]

const FAQ = [
  { q: 'Is it free to post a job?', a: 'Yes. Employer accounts and job posting are free to get started. If paid options are introduced in future, they will be clearly announced first.' },
  { q: 'Do candidates pay to apply?', a: 'No. Noble Job does not charge job seekers.' },
  { q: 'Why are jobs reviewed before they go live?', a: 'To protect job seekers from fake or misleading listings. You can read how we handle this on our job verification page.' },
  { q: 'What kinds of jobs can I post?', a: 'Private jobs, work-from-home jobs and abroad jobs. Government vacancies are published only from official sources by our own team.' },
]

export default function ForEmployersPage() {
  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <section style={{ background: 'linear-gradient(135deg,#060e28,#0d1f4e,#1847d4)', padding: '60px 0' }}>
        <div className="wrap" style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Playfair Display,serif', fontSize: 'clamp(30px,5vw,50px)', fontWeight: 900, color: '#fff', marginBottom: 16, lineHeight: 1.15 }}>
            Hire the right people across India
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.75, maxWidth: 640, margin: '0 auto 28px' }}>
            Post jobs for free, review applicants and search candidate profiles from one simple dashboard.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={REGISTER_HREF} style={{ background: '#f07020', color: '#fff', padding: '13px 30px', borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
              Create free employer account
            </Link>
            <Link href="/contact" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '2px solid rgba(255,255,255,.25)', padding: '11px 28px', borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 30, textAlign: 'center', marginBottom: 28 }}>
          Why employers use Noble Job
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20, marginBottom: 56 }}>
          {BENEFITS.map(b => (
            <div key={b.title} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden="true">{b.icon}</div>
              <h3 style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 17, marginBottom: 8 }}>{b.title}</h3>
              <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{b.text}</p>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 30, textAlign: 'center', marginBottom: 28 }}>
          How it works
        </h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: '0 auto 56px', maxWidth: 720, display: 'grid', gap: 16 }}>
          {STEPS.map(s => (
            <li key={s.n} style={{ display: 'flex', gap: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <span style={{ flex: '0 0 40px', height: 40, borderRadius: '50%', background: '#1847d4', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</span>
              <div>
                <h3 style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 16, margin: '0 0 4px' }}>{s.title}</h3>
                <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 30, textAlign: 'center', marginBottom: 24 }}>
          Questions employers ask
        </h2>
        <div style={{ maxWidth: 720, margin: '0 auto 48px', display: 'grid', gap: 14 }}>
          {FAQ.map(f => (
            <div key={f.q} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
              <h3 style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 15, margin: '0 0 6px' }}>{f.q}</h3>
              <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                {f.a}{f.q.startsWith('Why') ? <> <Link href="/job-verification-policy" style={{ color: '#1847d4' }}>Read our job verification policy</Link>.</> : null}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href={REGISTER_HREF} style={{ background: '#1847d4', color: '#fff', padding: '14px 34px', borderRadius: 10, fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
            Post your first job — free
          </Link>
        </div>
      </div>
    </div>
  )
}
