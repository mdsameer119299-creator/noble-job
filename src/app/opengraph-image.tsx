import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Noble Job — Find The Right Job, Build Your Bright Future'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#060e28 0%,#0d1f4e 50%,#1847d4 100%)', fontFamily: 'sans-serif', position: 'relative' }}>
        {/* NCC banner */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(255,255,255,.06)', borderBottom: '1px solid rgba(255,255,255,.1)', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fbbf24', fontSize: 18, fontWeight: 700 }}>🏛 A Livelihood Initiative by NCC FOUNDATION · Building India&apos;s Workforce</span>
        </div>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg,#f07020,#d95e10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900, color: '#fff' }}>NJ</div>
          <div>
            <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>NOBLE JOB</div>
            <div style={{ fontSize: 20, color: '#94a3b8', marginTop: 4 }}>Connecting Talent with Opportunity</div>
          </div>
        </div>
        {/* Headline */}
        <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', textAlign: 'center', maxWidth: 800, lineHeight: 1.25, marginBottom: 20 }}>
          Find The Right Job,{' '}
          <span style={{ color: '#f07020' }}>Build Your Bright Future</span>
        </div>
        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 40, marginTop: 16 }}>
          {[['80,000+','Jobs'],['2,500+','Companies'],['50,000+','Placed']].map(([n, l]) => (
            <div key={l} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#fbbf24' }}>{n}</span>
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,.65)' }}>{l}</span>
            </div>
          ))}
        </div>
        {/* Bottom bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.2)', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 16 }}>www.noblejob.in</span>
          <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 16 }}>support@noblejob.in · +91-9971177468</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
