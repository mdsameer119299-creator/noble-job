// AiEmployerTeaser — exact replica of original <div class="ai-emp-section">
// Dark gradient card (navy), 3-column grid: left steps, middle JD card, right matched candidates
// Original: Crown "For Employers" | AI Powered Candidate Search | 3 steps | Start AI Search Now →
import Link from 'next/link'

export function AiEmployerTeaser() {
  return (
    // White background outer, rounded dark card inside
    <div style={{ background: '#fff', padding: '40px 0 0' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          {/* Dark gradient card */}
          <div style={{
            background: 'linear-gradient(135deg,#0a1635 0%,#0d1f4e 40%,#0f2560 100%)',
            borderRadius: 24,
            padding: '52px 48px',
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr 1.2fr',
            gap: 36,
            alignItems: 'start',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,.07)',
          }}>
            {/* Radial glow left */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 600px 400px at 0% 50%, rgba(37,99,235,.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            {/* Circle glow top-right */}
            <div style={{
              position: 'absolute',
              top: -120, right: -80,
              width: 400, height: 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(96,165,250,.06) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />

            {/* ── LEFT COLUMN ── */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Eyebrow: crown + "For Employers" */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
                <span style={{ fontSize: 20 }}>👑</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', letterSpacing: '.15em', textTransform: 'uppercase' }}>For Employers</span>
              </div>

              <h2 style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: 46, fontWeight: 900,
                color: '#fff', lineHeight: 1.06,
                letterSpacing: '-.03em', marginBottom: 14,
              }}>AI Powered Candidate Search</h2>

              <p style={{ fontSize: 19, fontWeight: 500, color: '#93b4d8', marginBottom: 36, lineHeight: 1.5 }}>
                Find the best candidates in seconds.
              </p>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginBottom: 38 }}>
                {[
                  {
                    icon: <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>,
                    title: 'Upload Job Description',
                    sub: 'Add your job requirements',
                  },
                  {
                    icon: <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>,
                    title: 'AI Scans Resumes',
                    sub: 'Our AI matches the best profiles',
                  },
                  {
                    icon: <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/></svg>,
                    title: 'Get Top Matches',
                    sub: 'Review ranked & filtered candidates',
                  },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: 'rgba(37,99,235,.25)',
                      border: '1.5px solid rgba(96,165,250,.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#93c5fd',
                    }}>
                      {step.icon}
                    </div>
                    <div>
                      <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 4, letterSpacing: '-.01em' }}>{step.title}</p>
                      <span style={{ fontSize: 14.5, color: '#7a9bb8', lineHeight: 1.5 }}>{step.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/employer/candidates"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 11,
                  background: '#fff', color: '#0d1f4e',
                  padding: '16px 30px', borderRadius: 12,
                  fontSize: 16, fontWeight: 700,
                  border: 'none',
                  fontFamily: '"Playfair Display", serif',
                  boxShadow: '0 4px 20px rgba(0,0,0,.2)',
                  letterSpacing: '-.01em',
                  textDecoration: 'none',
                }}>
                Start AI Search Now →
              </Link>
            </div>

            {/* ── MIDDLE COLUMN: Job Description Card ── */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                background: '#fff', borderRadius: 18,
                padding: 28,
                boxShadow: '0 20px 60px rgba(0,0,0,.25)',
                position: 'relative', zIndex: 2,
              }}>
                <h4 style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 20, fontWeight: 800,
                  color: '#0d1f4e', marginBottom: 16,
                  letterSpacing: '-.02em',
                }}>Job Description</h4>

                <div style={{ background: '#f3f6fb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7 }}>
                    We are looking for a Senior Software Engineer with experience in React, Node.js, MongoDB and cloud technologies...
                  </p>
                </div>

                <div style={{ fontSize: 14.5, color: '#6b7280', lineHeight: 2, marginBottom: 20 }}>
                  <span><strong>Experience:</strong> 3-5 Years</span><br />
                  <span><strong>Location:</strong> Bangalore</span>
                </div>

                <Link href="/jobs/private"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    background: '#1847d4', color: '#fff',
                    padding: '15px 0', borderRadius: 10,
                    fontSize: 16, fontWeight: 700,
                    border: 'none', width: '100%',
                    fontFamily: '"Playfair Display", serif',
                    boxShadow: '0 4px 16px rgba(24,71,212,.4)',
                    letterSpacing: '-.01em',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}>
                  <svg fill="currentColor" viewBox="0 0 24 24" width={18} height={18}>
                    <path d="M9.4 10.5l4.77-8.26C13.47 2.09 12.75 2 12 2c-2.4 0-4.6.85-6.32 2.25L9.4 10.5zm12.28 1.5l-4.5-7.8c-1.2.89-2.18 2.08-2.84 3.46L17.97 14h3.54c.01-.17.03-.33.03-.5 0-.7-.1-1.37-.26-2h.4zm-9.65 7c-.56.98-1.59 1.63-2.74 1.63C7.24 20.63 6 19.39 6 17.88c0-.17.02-.33.05-.48L3.92 13.4c-.57.98-.92 2.1-.92 3.31C3 20.19 7.03 23 12 23c.47 0 .93-.04 1.38-.1L12.03 19z"/>
                  </svg>
                  ✦ Scan Resumes
                </Link>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Top Matched Candidates Card ── */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                background: '#f5f8ff', borderRadius: 18, padding: 26,
                boxShadow: '0 20px 60px rgba(0,0,0,.2)',
                position: 'relative', zIndex: 2,
              }}>
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <span style={{ fontFamily: '"Playfair Display", serif', fontSize: 17, fontWeight: 800, color: '#0d1f4e', letterSpacing: '-.01em' }}>Top Matched Candidates</span>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>AI Match Score</span>
                </div>

                {/* Candidate rows */}
                {[
                  { initials: 'RS', gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', name: 'Rahul Sharma', role: 'Senior Software Engineer', city: 'Bangalore, India', pct: '92%', offset: 21, ringColor: '#22c55e', label: 'Excellent Match', labelColor: '#15803d' },
                  { initials: 'PP', gradient: 'linear-gradient(135deg,#7c3aed,#5b21b6)', name: 'Priya Patel', role: 'Full Stack Developer', city: 'Bangalore, India', pct: '87%', offset: 32, ringColor: '#22c55e', label: 'Very Good Match', labelColor: '#15803d' },
                  { initials: 'VS', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', name: 'Vikram Singh', role: 'Software Engineer', city: 'Bangalore, India', pct: '78%', offset: 42, ringColor: '#f59e0b', label: 'Good Match', labelColor: '#d97706' },
                ].map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '15px 0',
                    borderBottom: i < 2 ? '1px solid rgba(13,31,78,.07)' : 'none',
                  }}>
                    {/* Left: avatar + info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: c.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {c.initials}
                      </div>
                      <div>
                        <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#0d1f4e', fontSize: 15, marginBottom: 2 }}>{c.name}</p>
                        <span style={{ display: 'block', fontSize: 12, color: '#374151', fontWeight: 500 }}>{c.role}</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#9ca3af' }}>{c.city}</span>
                      </div>
                    </div>

                    {/* Right: match ring */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: 64, height: 64 }}>
                        <svg viewBox="0 0 54 54" width={64} height={64}>
                          <circle cx={27} cy={27} r={22} fill="none" stroke="#e8eef8" strokeWidth={5} />
                          <circle cx={27} cy={27} r={22} fill="none" stroke={c.ringColor} strokeWidth={5}
                            strokeLinecap="round"
                            strokeDasharray="138.2"
                            strokeDashoffset={c.offset}
                            transform="rotate(-90 27 27)" />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: '"Playfair Display", serif', fontSize: 13, fontWeight: 900, color: '#0d1f4e' }}>
                          {c.pct}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.labelColor, marginTop: 2 }}>{c.label}</div>
                    </div>
                  </div>
                ))}

                <Link href="/employer/candidates"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginTop: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1847d4',
                    fontFamily: '"Playfair Display", serif',
                    textDecoration: 'none',
                  }}>
                  View All Matched Candidates →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Padding gap below card */}
      <div style={{ height: 0 }} />
    </div>
  )
}
