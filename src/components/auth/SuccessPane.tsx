import Link from 'next/link'
interface SuccessPaneProps { role: 'employer' | 'candidate'; name?: string }
export function SuccessPane({ role, name }: SuccessPaneProps) {
  const href = role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard'
  const msg = role === 'employer'
    ? 'Your employer account is active. Post your first job and start finding the right talent.'
    : 'Your profile is ready. Browse 19,000+ opportunities across private, WFH and abroad jobs.'
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 64, marginBottom: 14 }}>🎉</div>
      <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 24, marginBottom: 8 }}>
        Welcome to Noble Job{name ? `, ${name}` : ''}!
      </h2>
      <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, marginBottom: 26 }}>{msg}</p>
      <Link href={href}
        style={{ display: 'inline-block', background: '#f07020', color: '#fff', padding: '13px 32px', borderRadius: 10, fontWeight: 900, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 14px rgba(240,112,32,.4)' }}>
        Go to Dashboard →
      </Link>
    </div>
  )
}
