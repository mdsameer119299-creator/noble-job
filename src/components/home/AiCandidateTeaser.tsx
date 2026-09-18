import Link from 'next/link'

export function AiCandidateTeaser() {
  return (
    <section id="cv-analysis-section" className="cv-analysis-section" style={{ background: '#edf2fb', padding: '44px 0' }}>
      <div className="wrap cv-analysis-section__inner" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 clamp(16px, 4vw, 48px)', display: 'flex', alignItems: 'center', gap: 38, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" width={100} height={100} aria-hidden>
              <circle cx={50} cy={50} r={40} fill="none" stroke="#dde4ef" strokeWidth={8} />
              <circle
                cx={50}
                cy={50}
                r={40}
                fill="none"
                stroke="#1847d4"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray="251.3"
                strokeDashoffset="32.7"
                transform="rotate(-90 50 50)"
              />
            </svg>

            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                textAlign: 'center',
                lineHeight: 1.1,
              }}
            >
              <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 26, fontWeight: 800, color: '#0d1f4e' }}>87%</div>
              <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 500 }}>Great Score</div>
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 26,
                height: 26,
                background: '#15803d',
                borderRadius: '50%',
                border: '2px solid #edf2fb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg fill="currentColor" viewBox="0 0 24 24" width={14} height={14} style={{ color: '#fff' }} aria-hidden>
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: 26,
                fontWeight: 800,
                color: '#1847d4',
                letterSpacing: '-.02em',
                marginBottom: 8,
              }}
            >
              AI Powered CV Analysis
            </h2>

            <p style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 18, lineHeight: 1.6 }}>
              Get your CV analyzed by AI and improve your chances of getting hired.
            </p>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {['AI Score & Match', 'Skills Analysis', 'Improve Suggestions', 'Job Recommendations'].map(feat => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  <svg fill="currentColor" viewBox="0 0 24 24" width={16} height={16} style={{ color: '#15803d', flexShrink: 0 }} aria-hidden>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  {feat}
                </div>
              ))}
            </div>
          </div>

          <div className="cv-analysis-section__cta-col" style={{ flexShrink: 0, textAlign: 'center' }}>
            <Link
              href="/upload-resume"
              className="cv-upload-cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                background: '#1847d4',
                color: '#fff',
                padding: '15px 28px',
                borderRadius: 10,
                fontSize: 14.5,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(24,71,212,.3)',
                whiteSpace: 'nowrap',
                fontFamily: '"DM Sans", sans-serif',
                textDecoration: 'none',
              }}
            >
              <svg fill="currentColor" viewBox="0 0 24 24" width={16} height={16} aria-hidden>
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
              Upload Your CV
            </Link>
            <p style={{ fontSize: 11.5, color: '#6b7280', marginTop: 9, fontWeight: 400 }}>
              It&apos;s free and only takes a few seconds
            </p>
          </div>
      </div>
    </section>
  )
}
