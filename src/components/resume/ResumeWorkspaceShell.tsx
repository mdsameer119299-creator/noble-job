'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { getResumeWorkspaceMode, type ResumeWorkspaceModeKey } from '@/lib/resume/resumeWorkspace'
import { track, AcqEvent } from '@/lib/analytics/events'
import { ImproveFlow } from './flows/ImproveFlow'
import { BuildFlow } from './flows/BuildFlow'
import { TailorFlow } from './flows/TailorFlow'

/**
 * Shared Noble Resume AI workspace shell. Every /resume/* mode renders inside
 * this one shell: product identity, mode title + explanation, a step indicator,
 * contextual privacy/truthfulness messaging, an entry-flow slot, and consistent
 * navigation back to Noble Job / the Career Report.
 *
 * This PR ships the shell + truthful pre-engine entry flows only. The step
 * indicator sits on step 1 (the entry flow); later steps are shown as upcoming
 * until the Resume Intelligence engine ships in a future PR.
 */
export function ResumeWorkspaceShell({ mode }: { mode: ResumeWorkspaceModeKey }) {
  const cfg = getResumeWorkspaceMode(mode)
  useEffect(() => {
    if (cfg) track(AcqEvent.RESUME_WORKSPACE_VIEWED, { mode })
  }, [mode, cfg])

  if (!cfg) return null

  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <div className="wrap" style={{ maxWidth: 780, margin: '0 auto', paddingTop: 24, paddingBottom: 64 }}>
        {/* Back navigation */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: 18 }}>
          <Link href="/" style={backLink} aria-label="Back to Noble Job home">← Noble Job</Link>
        </nav>

        {/* Product identity + title */}
        <header style={{ marginBottom: 18 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#eef2ff', border: '1px solid #dbe4ff', borderRadius: 999, padding: '5px 13px', marginBottom: 12 }}>
            <span aria-hidden>{cfg.emoji}</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#1847d4' }}>{cfg.eyebrow}</span>
          </div>
          <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 'clamp(26px,4.5vw,40px)', lineHeight: 1.12, margin: '0 0 8px' }}>
            {cfg.title}
          </h1>
          <p style={{ color: '#475569', fontSize: 16, margin: 0 }}>{cfg.tagline}</p>
        </header>

        {/* Step indicator */}
        <StepIndicator steps={cfg.steps} current={0} />

        {/* Explanation */}
        <p style={{ color: '#374151', fontSize: 14.5, lineHeight: 1.7, margin: '18px 0 14px' }}>{cfg.explanation}</p>

        {/* Contextual privacy / truthfulness messaging */}
        <div role="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', marginBottom: 22 }}>
          <span aria-hidden style={{ fontSize: 15, lineHeight: 1.4 }}>🔒</span>
          <p style={{ margin: 0, color: '#475569', fontSize: 12.8, lineHeight: 1.6 }}>{cfg.truthfulness}</p>
        </div>

        {/* Entry-flow slot */}
        <section aria-label={`${cfg.title} — get started`}>
          {cfg.entryFlow === 'improve' && <ImproveFlow />}
          {cfg.entryFlow === 'build' && <BuildFlow />}
          {cfg.entryFlow === 'tailor' && <TailorFlow />}
        </section>

        {/* Honest pre-engine boundary */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 22, padding: '13px 15px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12 }}>
          <span aria-hidden style={{ fontSize: 15 }}>🚧</span>
          <p style={{ margin: 0, color: '#92400e', fontSize: 12.8, lineHeight: 1.6 }}>{cfg.futureNote}</p>
        </div>

        {/* Consistent secondary nav — never a dead end */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
          <Link href="/jobs/private" style={secondaryLink}>Browse genuine jobs</Link>
          <Link href="/" style={secondaryLink}>Back to Noble Job home</Link>
        </div>
      </div>
    </div>
  )
}

/** Horizontal step indicator. `current` is the 0-based active step; later steps
 *  render muted with a "soon" marker (the engine is not live yet). */
function StepIndicator({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol
      aria-label="Progress"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}
    >
      {steps.map((label, i) => {
        const active = i === current
        const done = i < current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: active ? '#1847d4' : '#fff',
              border: `1.5px solid ${active ? '#1847d4' : '#e2e8f0'}`,
              color: active ? '#fff' : '#94a3b8',
              borderRadius: 999, padding: '5px 12px 5px 6px', fontSize: 12, fontWeight: 700,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
                background: active ? 'rgba(255,255,255,.2)' : done ? '#dbeafe' : '#f1f5f9',
                color: active ? '#fff' : done ? '#1847d4' : '#94a3b8',
              }}
            >
              {done ? '✓' : i + 1}
            </span>
            <span>{label}</span>
            {i > current && <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1' }} aria-label="upcoming">soon</span>}
          </li>
        )
      })}
    </ol>
  )
}

const backLink = { color: '#1847d4', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' } as const
const secondaryLink = { color: '#1847d4', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' } as const
