// EmployerCta — exact replica of original <section class="hiring">
// Dark navy card (.hiring-card), 5-column grid: left hiring CTA + 4 feature tiles
import Link from 'next/link'

export function EmployerCta() {
  const features = [
    {
      icon: (
        <svg fill="none" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width={28} height={28}>
          <path d="M12 2a4 4 0 014 4c0 1.5-.8 2.8-2 3.46V11h2a2 2 0 012 2v1a2 2 0 01-2 2h-.5l-.5 3H9l-.5-3H8a2 2 0 01-2-2v-1a2 2 0 012-2h2V9.46A4 4 0 0112 2z"/>
          <path d="M9 17v2a1 1 0 001 1h4a1 1 0 001-1v-2"/>
          <path d="M7 7H4M20 7h-3M12 2V1M5.5 4.5L3 3M18.5 4.5L21 3"/>
        </svg>
      ),
      title: 'AI Candidate Search',
      desc: 'Smart matching for better results',
    },
    {
      icon: (
        <svg fill="none" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width={28} height={28}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      ),
      title: 'Verified Candidates',
      desc: '100% verified & quality profiles',
    },
    {
      icon: (
        <svg fill="none" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width={28} height={28}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      title: 'Save Time & Cost',
      desc: 'Automate screening, save 80% time',
    },
    {
      icon: (
        <svg fill="none" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width={28} height={28}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          <path d="M8 10h.01M12 10h.01M16 10h.01"/>
        </svg>
      ),
      title: 'Dedicated Support',
      desc: "We're here to help you hire better",
    },
  ]

  return (
    <section style={{ background: '#fff', padding: '32px 0 40px' }}>
      <div className="section-inner-pad" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 clamp(16px, 4vw, 48px)' }}>
        {/* Dark navy card */}
        <div className="employer-cta-grid" style={{
          background: '#0a1635',
          borderRadius: 20,
          padding: 'clamp(24px, 5vw, 48px) clamp(20px, 4vw, 44px)',
          display: 'grid',
          gap: 28,
          alignItems: 'center',
        }}>
          {/* LEFT: CTA */}
          <div>
            {/* Email icon box */}
            <div style={{
              width: 70, height: 70,
              background: 'rgba(37,99,235,.18)',
              borderRadius: 16,
              border: '1.5px solid rgba(96,165,250,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 22,
            }}>
              <svg fill="currentColor" viewBox="0 0 24 24" width={34} height={34} style={{ color: '#60a5fa' }}>
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>

            <h2 style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: 26, fontWeight: 800,
              color: '#fff', lineHeight: 1.15,
              letterSpacing: '-.02em', marginBottom: 12,
            }}>Are You Hiring?</h2>

            <p style={{ color: '#8da8c8', fontSize: 14, lineHeight: 1.65, marginBottom: 22 }}>
              Post your job for free and get matched with the best talent using our AI technology.
            </p>

            <Link href="/auth?role=employer"
              style={{
                display: 'block',
                background: '#fff', color: '#0d1f4e',
                padding: '13px 24px', borderRadius: 10,
                fontSize: 14.5, fontWeight: 700,
                marginBottom: 13, textAlign: 'center',
                fontFamily: '"Playfair Display", serif',
                textDecoration: 'none',
                transition: 'all .2s',
              }}>
              Post a Job for Free
            </Link>

            <Link href="/employer/dashboard"
              style={{
                fontSize: 13.5, color: '#60a5fa', fontWeight: 500,
                textDecoration: 'none',
              }}>
              Explore Employer Solutions →
            </Link>
          </div>

          {/* Feature tiles */}
          {features.map((feat, i) => (
            <div key={i} style={{ textAlign: 'center', padding: 10 }}>
              <div style={{
                width: 64, height: 64,
                background: 'rgba(37,99,235,.12)',
                border: '1.5px solid rgba(96,165,250,.3)',
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                {feat.icon}
              </div>
              <h4 style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: 17, fontWeight: 700,
                color: '#f1f5f9', marginBottom: 9,
                letterSpacing: '-.01em',
              }}>{feat.title}</h4>
              <p style={{ fontSize: 14, color: '#7a9bb8', lineHeight: 1.6 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
