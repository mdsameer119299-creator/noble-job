import Link from 'next/link'
import type { ResumeModeKey } from '@/lib/resume/resumeModes'

/**
 * Honest "coming soon" destination for a future Resume AI mode (Improve / Build
 * / Tailor). It does NOT pretend the AI engine exists — it explains the upcoming
 * capability in plain future tense and always offers meaningful next actions
 * (get a Career Report, browse genuine jobs, create a free account) so the page
 * is never a dead end. Server component: no client JS, no data fetching.
 *
 * The site-wide floating "Upload Resume & Get AI Career Report" launcher is also
 * present on this route, so re-running the report is always one tap away.
 */

type Content = {
  eyebrow: string
  title: string
  blurb: string
  bullets: string[]
}

const CONTENT: Record<Exclude<ResumeModeKey, 'report'>, Content> = {
  improve: {
    eyebrow: 'Resume AI · Improve',
    title: 'Improve My Resume',
    blurb:
      'We’re building an AI resume review that turns your Career Report into concrete fixes — ATS formatting, clearer wording, missing sections and quantified achievements — always based only on what’s truly in your resume, never invented.',
    bullets: [
      'Fix ATS parsing, structure and formatting issues',
      'Sharpen weak summaries and bullet points',
      'Flag gaps and ask you — never fabricate facts',
      'Re-check your score after every change',
    ],
  },
  build: {
    eyebrow: 'Resume AI · Build',
    title: 'Build a Professional Resume',
    blurb:
      'A guided builder that creates a strong, recruiter-ready resume from scratch. It will ask you for the facts it needs and assemble them into a clean, ATS-friendly document — with your details always under your control.',
    bullets: [
      'Step-by-step, guided resume creation',
      'ATS-safe, professional templates',
      'Only your real, confirmed details are used',
      'Export-ready when the engine launches',
    ],
  },
  tailor: {
    eyebrow: 'Resume AI · Tailor',
    title: 'Tailor Your Resume for a Job',
    blurb:
      'Paste a job description or pick a genuine Noble Job vacancy and we’ll help align your resume to what the role actually asks for — truthfully, highlighting the real strengths you already have.',
    bullets: [
      'Match your resume to a specific vacancy',
      'Compare requirements against your real experience',
      'Keep every claim truthful and verifiable',
      'Works with genuine Noble Job vacancies',
    ],
  },
}

export function ResumeModePlaceholder({ mode }: { mode: Exclude<ResumeModeKey, 'report'> }) {
  const c = CONTENT[mode]
  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#060e28,#0d1f4e,#1847d4)', padding: '56px 0' }}>
        <div className="wrap" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 24, padding: '6px 18px', marginBottom: 18 }}>
            <span style={{ color: '#fbbf24', fontSize: 12.5, fontWeight: 800, letterSpacing: '.04em' }}>🚀 {c.eyebrow} · Coming soon</span>
          </div>
          <h1 style={{ fontFamily: 'Playfair Display,serif', fontSize: 'clamp(30px,5vw,50px)', fontWeight: 900, color: '#fff', marginBottom: 14, lineHeight: 1.15 }}>
            {c.title}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.75, maxWidth: 600, margin: '0 auto' }}>
            {c.blurb}
          </p>
        </div>
      </section>

      <div className="wrap" style={{ maxWidth: 760, margin: '0 auto', paddingTop: 40, paddingBottom: 64 }}>
        {/* Honest "what this will do" */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '26px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(24,71,212,.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1847d4', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>What this will do</div>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: 14.5, lineHeight: 1.9 }}>
            {c.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
          <p style={{ color: '#6b7280', fontSize: 12.5, marginTop: 16, marginBottom: 0 }}>
            This feature isn’t live yet — we’re building it carefully so it stays honest and accurate. In the meantime, you can already get your free Career Report and explore genuine jobs.
          </p>
        </div>

        {/* Meaningful actions — no dead ends */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          <Link href="/" aria-label="Get your free AI Career Report" style={cardPrimary}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
            <div style={cardTitleLight}>Get your Career Report</div>
            <div style={cardSubLight}>Upload your resume for an instant free score</div>
          </Link>
          <Link href="/jobs/private" aria-label="Browse genuine jobs on Noble Job" style={card}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🔍</div>
            <div style={cardTitle}>Browse genuine jobs</div>
            <div style={cardSub}>Government, private, WFH & abroad roles</div>
          </Link>
          <Link href="/auth?role=candidate" aria-label="Create a free Noble Job account" style={card}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
            <div style={cardTitle}>Create a free account</div>
            <div style={cardSub}>Save your progress & apply to jobs</div>
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <Link href="/" style={{ color: '#1847d4', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>← Back to Noble Job home</Link>
        </div>
      </div>
    </div>
  )
}

const card = { display: 'block', textDecoration: 'none', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '18px 18px' } as const
const cardPrimary = { ...card, background: 'linear-gradient(135deg,#1847d4,#0d1f4e)', border: '1.5px solid #1847d4' } as const
const cardTitle = { fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 3 } as const
const cardSub = { color: '#6b7280', fontSize: 12.5, lineHeight: 1.5 } as const
const cardTitleLight = { fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#fff', fontSize: 16, marginBottom: 3 } as const
const cardSubLight = { color: 'rgba(255,255,255,.8)', fontSize: 12.5, lineHeight: 1.5 } as const
