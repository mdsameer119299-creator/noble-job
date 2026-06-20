import Link from 'next/link'
import { CONTACT_INFO } from '@/lib/constants/contactInfo'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { SOCIAL_PLATFORMS, SocialBrandIcon } from '@/components/shared/SocialBrandIcon'

const JOB_SEEKERS = [
  { label: 'Browse Jobs', href: '/jobs/private' },
  { label: 'Government Jobs', href: '/jobs/govt' },
  { label: 'Work From Home', href: '/jobs/wfh' },
  { label: 'Abroad Jobs', href: '/jobs/abroad' },
  { label: 'Career Guides', href: '/guides' },
  { label: 'Upload Your CV', href: '/auth?role=candidate&tab=register' },
]
const EMPLOYERS = [
  { label: 'Post a Job', href: '/employer/jobs/new' },
  { label: 'Find Candidates', href: '/employer/candidates' },
  { label: 'Employer Dashboard', href: '/employer/dashboard' },
  { label: 'Pricing Plans', href: '/employer/billing' },
]
const POPULAR_SEARCHES = [
  { label: 'Government Jobs', href: '/government-jobs' },
  { label: 'Private Jobs', href: '/private-jobs' },
  { label: 'Work From Home Jobs', href: '/work-from-home-jobs' },
  { label: 'Jobs Abroad', href: '/jobs-abroad' },
  { label: 'Fresher Jobs', href: '/fresher-jobs' },
  { label: 'Jobs in Delhi', href: '/jobs-in-delhi' },
  { label: 'Jobs in Gurgaon', href: '/jobs-in-gurgaon' },
  { label: 'Jobs in Noida', href: '/jobs-in-noida' },
  { label: 'Jobs in Mumbai', href: '/jobs-in-mumbai' },
  { label: 'Jobs in Bangalore', href: '/jobs-in-bangalore' },
  { label: 'Jobs in Hyderabad', href: '/jobs-in-hyderabad' },
  { label: 'Jobs in Pune', href: '/jobs-in-pune' },
  { label: 'Jobs in Chennai', href: '/jobs-in-chennai' },
]
const IMPORTANT = [
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Editorial Policy', href: '/editorial-policy' },
  { label: 'Job Verification', href: '/job-verification-policy' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms' },
]

export function Footer() {
  return (
    <footer style={{ background: '#040d1e', padding: '56px 0 0' }}>
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <BrandLogo variant="dark" logoSize={64} style={{ marginBottom: 20 }} />
            <p style={{ fontSize: 13.5, color: '#a7b4c6', lineHeight: 1.75, marginBottom: 20, maxWidth: 300 }}>
              A premier job portal by <strong style={{ color: '#fbbf24' }}>NCC Foundation</strong>, dedicated to empowering India&apos;s workforce.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {SOCIAL_PLATFORMS.map(s => (
                <a
                  key={s.platform}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.name}
                  style={{ textDecoration: 'none', transition: 'transform .2s' }}
                  className="hover:scale-110"
                >
                  <SocialBrandIcon platform={s.platform} size={38} />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ color: '#fff', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Job Seekers</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {JOB_SEEKERS.map(l => (
                <li key={l.href}><Link href={l.href} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', transition: 'color .2s' }}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#fff', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Employers</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {EMPLOYERS.map(l => (
                <li key={l.href}><Link href={l.href} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#fff', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href={CONTACT_INFO.phoneTel} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', display: 'flex', gap: 8 }}>📞 {CONTACT_INFO.phone}</a>
              <a href={CONTACT_INFO.emailTo} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', display: 'flex', gap: 8 }}>✉️ {CONTACT_INFO.email}</a>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, lineHeight: 1.6 }}>📍 {CONTACT_INFO.address}</p>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.10)', paddingTop: 24, marginTop: 8 }}>
          <h4 style={{ color: '#fff', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Popular Job Searches</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginBottom: 8 }}>
            {POPULAR_SEARCHES.map(l => (
              <Link key={l.href} href={l.href} style={{ color: '#94a3b8', fontSize: 12.5, textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.10)', padding: '24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ color: '#8b98ac', fontSize: 12.5, margin: 0, letterSpacing: '.01em' }}>© {new Date().getFullYear()} Noble Job — An Initiative of NCC Foundation. All rights reserved.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {IMPORTANT.map(l => (
              <Link key={l.href} href={l.href} style={{ color: '#94a3b8', fontSize: 12.5, fontWeight: 500, textDecoration: 'none', transition: 'color .2s', lineHeight: 1 }}>{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
