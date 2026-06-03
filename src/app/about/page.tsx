import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import Link from 'next/link'
import { CONTACT_INFO } from '@/lib/constants/contactInfo'
import { SOCIAL_LINKS } from '@/lib/constants/socialLinks'

export const metadata: Metadata = buildPageMetadata({
  title: 'About Noble Job — Job Portal India by NCC Foundation',
  description:
    'Learn about Noble Job, a Job Portal India initiative connecting talent with Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs.',
  path: '/about',
  keywords: ['Noble Job', 'NCC Foundation', 'Job Portal India'],
})

export default function AboutPage() {
  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#060e28,#0d1f4e,#1847d4)', padding: '60px 0' }}>
        <div className="wrap" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 24, padding: '6px 18px', marginBottom: 20 }}>
            <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>🏛 A Livelihood Initiative by NCC FOUNDATION</span>
          </div>
          <h1 style={{ fontFamily: 'Playfair Display,serif', fontSize: 'clamp(32px,5vw,54px)', fontWeight: 900, color: '#fff', marginBottom: 16, lineHeight: 1.15 }}>
            About Noble Job
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 17, lineHeight: 1.75, maxWidth: 620, margin: '0 auto 28px' }}>
            Noble Job is India&apos;s premier job portal, built by NCC Foundation to connect talented professionals with their dream careers — for free, forever.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/jobs/private" style={{ background: '#f07020', color: '#fff', padding: '12px 28px', borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>Browse Jobs</Link>
            <Link href="/contact" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '2px solid rgba(255,255,255,.25)', padding: '12px 28px', borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>Contact Us</Link>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 64 }}>

        {/* Mission */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 48, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1847d4', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Our Mission</div>
            <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 32, marginBottom: 14 }}>Empowering India&apos;s Workforce</h2>
            <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>
              Noble Job was founded with a singular purpose: to make quality employment accessible to every Indian — regardless of background, location or economic status. We believe every talented individual deserves a fair shot at a great career.
            </p>
            <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.8 }}>
              As an initiative of <strong>NCC Foundation</strong>, we operate on a strict no-fee-from-candidates policy. We earn from verified employers only, ensuring our interests always align with the job seeker.
            </p>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#1847d4,#0d1f4e)', borderRadius: 20, padding: '36px', textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🏛</div>
            <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>NCC Foundation</h3>
            <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, lineHeight: 1.65 }}>A non-profit organisation dedicated to livelihood generation and skill development for underprivileged communities across India.</p>
          </div>
        </div>

        {/* Values */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 30 }}>Our Core Values</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {[
              { icon: '🛡️', title: 'Zero Fake Jobs', desc: 'Every listing passes our 40-point anti-scam filter. We partner only with verified employers and official company career pages.' },
              { icon: '💰', title: 'Always Free for Candidates', desc: 'Noble Job has never charged a job seeker and never will. This is written into our founding charter.' },
              { icon: '🤝', title: 'Trusted by 2,500+ Employers', desc: 'From TCS and Infosys to local SMEs, our employer network spans every major industry in India.' },
              { icon: '🌍', title: 'Pan-India Reach', desc: 'Jobs across 800+ cities — from metro hubs like Delhi and Bangalore to Tier 2/3 cities and rural India.' },
              { icon: '🤖', title: 'AI-Powered Matching', desc: 'Our AI engine matches candidates to the right jobs based on skills, experience and location preferences.' },
              { icon: '📊', title: 'Transparency First', desc: 'We publish our anti-scam policy, fee structure and contact details openly. No hidden charges, ever.' },
            ].map((v, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '24px 20px', boxShadow: '0 2px 12px rgba(24,71,212,.06)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{v.icon}</div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 17, marginBottom: 8 }}>{v.title}</h3>
                <p style={{ color: '#374151', fontSize: 13.5, lineHeight: 1.7 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ background: 'linear-gradient(135deg,#0d1f4e,#1847d4)', borderRadius: 20, padding: '40px', marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#fff', fontSize: 28, textAlign: 'center', marginBottom: 32 }}>Noble Job by Numbers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {[{n:'80,000+',l:'Jobs Posted',i:'💼'},{n:'2,500+',l:'Verified Employers',i:'🏢'},{n:'50,000+',l:'Candidates Placed',i:'✅'},{n:'800+',l:'Cities Covered',i:'🗺️'}].map((s,i)=>(
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{s.i}</div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 32, fontWeight: 900, color: '#fbbf24' }}>{s.n}</div>
                <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 28, marginBottom: 24 }}>Contact Our Team</h2>
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px', display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#1847d4,#0d1f4e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 26, flexShrink: 0 }}>N</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 20, marginBottom: 2 }}>{CONTACT_INFO.person}</div>
              <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>{CONTACT_INFO.role} · Noble Job / NCC Foundation</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <a href={CONTACT_INFO.phoneTel} style={{ color: '#1847d4', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>📞 {CONTACT_INFO.phone}</a>
                <a href={CONTACT_INFO.emailTo} style={{ color: '#1847d4', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>✉️ {CONTACT_INFO.email}</a>
              </div>
            </div>
          </div>
        </div>

        {/* Office */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px', marginBottom: 48 }}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 16 }}>Our Office</h3>
          <p style={{ color: '#374151', fontSize: 15, marginBottom: 4 }}>📍 {CONTACT_INFO.address}</p>
          <p style={{ color: '#6b7280', fontSize: 13 }}>New Delhi, India · Open Monday–Saturday, 10:00 AM – 6:30 PM IST</p>
        </div>

        {/* Privacy Policy anchor */}
        <div id="privacy" style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px', marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 14 }}>Privacy Policy</h3>
          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.75 }}>Noble Job collects candidate and employer information solely to facilitate job matching and recruitment. We never sell personal data to third parties. Candidate data is encrypted at rest and in transit. Employers may view candidate profiles only after the candidate applies to their job. You may request deletion of your data at any time by emailing <a href="mailto:support@noblejob.in" style={{ color: '#1847d4', fontWeight: 700 }}>support@noblejob.in</a>.</p>
        </div>

        <div id="terms" style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px' }}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 14 }}>Terms of Service</h3>
          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.75 }}>By using Noble Job, you agree not to post fraudulent job listings, misrepresent your qualifications, or use the platform for any unlawful purpose. Noble Job reserves the right to remove any listing or account that violates these terms. Employers posting jobs take responsibility for the accuracy of their listings. Noble Job is not liable for any employment decisions made based on platform listings.</p>
        </div>

      </div>
    </div>
  )
}
