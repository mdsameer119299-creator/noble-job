// Topbar — phone, email, Job Seeker + Employer CTA buttons
// Exact replica of original topbar with tb-left + tb-right
import Link from 'next/link'
import { CONTACT_INFO } from '@/lib/constants/contactInfo'

export function Topbar() {
  return (
    <div className="w-full py-2" style={{background:'#0d1f4e'}}>
      <div className="wrap flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 text-sm" style={{color:'#94a3b8'}}>
          <a href={CONTACT_INFO.phoneTel} className="flex items-center gap-1.5 hover:text-white transition-colors no-underline" style={{color:'#94a3b8'}}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.32.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.01L6.6 10.8z"/></svg>
            {CONTACT_INFO.phone}
          </a>
          <a href={CONTACT_INFO.emailTo} className="flex items-center gap-1.5 hover:text-white transition-colors no-underline" style={{color:'#94a3b8'}}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
            {CONTACT_INFO.email}
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/auth?role=candidate" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all no-underline"
            style={{border:'2px solid rgba(240,112,32,.5)',color:'#f07020',background:'rgba(240,112,32,.08)'}}>
            👤 Job Seeker
          </Link>
          <Link href="/auth?role=employer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all no-underline"
            style={{background:'#f07020',color:'#fff',border:'2px solid #f07020'}}>
            🏢 Employer
          </Link>
        </div>
      </div>
    </div>
  )
}
