import Link from 'next/link'

export function AiMatchingSidebar() {
  return (
    <div style={{ background: 'linear-gradient(135deg,#1847d4,#0d1f4e)', borderRadius: 16, padding: '22px 20px', color: '#fff' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, fontSize: 18, marginBottom: 10 }}>AI Powered Job Matching</h3>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', lineHeight: 1.65, marginBottom: 18 }}>
        Get personalised job recommendations based on your skills, experience and preferences.
      </p>
      <Link href="/auth?role=candidate&tab=register"
        style={{ display: 'block', background: '#f07020', color: '#fff', padding: '10px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
        Get AI Matches →
      </Link>
    </div>
  )
}
