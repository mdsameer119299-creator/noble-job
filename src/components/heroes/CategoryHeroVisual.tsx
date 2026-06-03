import type { HeroVariant } from '@/lib/services/heroStatsService'
import { IndiaStateEmblem } from './IndiaStateEmblem'

/** Center-column visual storytelling (CSS / SVG — no external assets required). */
export function CategoryHeroVisual({ variant }: { variant: HeroVariant }) {
  switch (variant) {
    case 'govt':
      return <GovtEmblemVisual />
    case 'banking':
      return <BankingVisual />
    case 'upsc':
      return <InstitutionVisual label="Union Public Service Commission" />
    case 'railway':
      return <RailwayVisual />
    case 'ssc':
      return <ExamPrepVisual />
    case 'teaching':
      return <TeachingVisual />
    case 'defence':
      return <DefenceVisual />
    case 'police':
      return <PoliceVisual />
    case 'engineering':
      return <EngineeringVisual />
    case 'psu':
      return <PsuVisual />
    case 'private':
      return <CorporateVisual />
    case 'wfh':
      return <WfhVisual />
    case 'abroad':
      return <WorldMapVisual />
    default:
      return <GovtBuildingVisual />
  }
}

function CorporateVisual() {
  return (
    <div className="category-hero__center-figure">
      <div style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,.18), rgba(255,255,255,.04))',
        border: '1px solid rgba(255,255,255,.2)',
        borderRadius: 20,
        padding: '28px 24px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
          <PersonSilhouette label="Executive" color="#93c5fd" />
          <PersonSilhouette label="Leader" color="#fcd34d" flip />
        </div>
        <p style={{ color: 'rgba(255,255,255,.85)', fontSize: 13, fontWeight: 600, margin: 0 }}>
          Corporate careers · Leadership · Growth
        </p>
      </div>
    </div>
  )
}

function PersonSilhouette({ label, color, flip }: { label: string; color: string; flip?: boolean }) {
  return (
    <div style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <svg width="72" height="88" viewBox="0 0 72 88" fill="none">
        <circle cx="36" cy="18" r="14" fill={color} opacity="0.9" />
        <path d="M12 88c4-22 20-34 24-34s20 12 24 34" fill={color} opacity="0.75" />
        <rect x="22" y="38" width="28" height="36" rx="6" fill={color} opacity="0.5" />
      </svg>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 700, marginTop: 4 }}>{label}</div>
    </div>
  )
}

function WfhVisual() {
  return (
    <div className="category-hero__center-figure">
      <div
        style={{
          position: 'relative',
          maxWidth: 340,
          margin: '0 auto',
          padding: '8px 0',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.04))',
            border: '1px solid rgba(255,255,255,.22)',
            borderRadius: 22,
            padding: '20px 18px 16px',
            boxShadow: '0 20px 50px rgba(0,0,0,.25)',
          }}
        >
          <svg viewBox="0 0 280 200" width="100%" height="auto" aria-hidden style={{ display: 'block' }}>
            <defs>
              <linearGradient id="wfh-desk" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <rect x="30" y="130" width="220" height="12" rx="4" fill="rgba(255,255,255,.25)" />
            <rect x="70" y="95" width="140" height="42" rx="6" fill="#1e1b4b" stroke="rgba(255,255,255,.2)" strokeWidth="2" />
            <rect x="78" y="102" width="124" height="28" rx="3" fill="#312e81" />
            <rect x="86" y="118" width="36" height="4" rx="2" fill="#a78bfa" />
            <rect x="128" y="118" width="48" height="4" rx="2" fill="#818cf8" opacity=".7" />
            <circle cx="200" cy="75" r="28" fill="url(#wfh-desk)" opacity=".9" />
            <path d="M178 75 Q200 48 222 75 Q200 88 178 75" fill="#c4b5fd" />
            <rect x="188" y="72" width="24" height="8" rx="3" fill="#1e1b4b" />
            <path d="M95 95 L115 55 L135 95 Z" fill="#fcd34d" opacity=".85" />
            <rect x="108" y="55" width="14" height="10" rx="2" fill="#fbbf24" />
            <circle cx="48" cy="52" r="14" fill="rgba(34,197,94,.35)" />
            <text x="48" y="57" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">✓</text>
            <text x="140" y="185" textAnchor="middle" fill="rgba(255,255,255,.75)" fontSize="11" fontWeight="600">
              Remote professional · Home office
            </text>
          </svg>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: -8,
            background: 'rgba(255,255,255,.14)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 12,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          🏠 WFH
        </div>
      </div>
    </div>
  )
}

function WorldMapVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg className="category-hero__map-svg" viewBox="0 0 320 180" fill="none">
        <ellipse cx="160" cy="90" rx="140" ry="70" stroke="rgba(56,189,248,.35)" strokeWidth="1.5" strokeDasharray="6 4" />
        <path d="M40 100 Q120 60 200 85 T280 70" stroke="#38bdf8" strokeWidth="2" className="category-hero__route-line" fill="none" opacity="0.8" />
        <circle cx="220" cy="75" r="6" fill="#fbbf24" />
        <circle cx="90" cy="95" r="5" fill="#38bdf8" />
        <circle cx="160" cy="88" r="7" fill="#22c55e" />
        <text x="160" y="165" textAnchor="middle" fill="rgba(255,255,255,.6)" fontSize="11" fontWeight="600">Global workforce routes</text>
      </svg>
      <div style={{ textAlign: 'center', fontSize: 36, marginTop: -8 }}>✈️</div>
    </div>
  )
}

const GOVT_TAGLINE = 'Authority · Trust · Public Service'

function GovtEmblemVisual() {
  return (
    <div className="category-hero__center-figure category-hero__govt-emblem">
      <div className="category-hero__govt-emblem__halo" aria-hidden>
        <IndiaStateEmblem className="category-hero__govt-emblem__svg" />
      </div>
      <p className="category-hero__govt-emblem__tagline">{GOVT_TAGLINE}</p>
    </div>
  )
}

function BankingVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="200" height="140" viewBox="0 0 200 140" style={{ display: 'block', margin: '0 auto' }}>
        <path d="M20 55h160M35 55v50M65 55v50M95 55v50M125 55v50M155 55v50M100 28l75 27H25l75-27z" stroke="rgba(134,239,172,.75)" strokeWidth="2.5" fill="rgba(255,255,255,.08)" strokeLinejoin="round" />
        <rect x="70" y="70" width="60" height="35" rx="4" fill="rgba(251,191,36,.2)" stroke="rgba(251,191,36,.45)" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, marginTop: 8 }}>SBI · IBPS · RBI · NABARD</p>
    </div>
  )
}

function InstitutionVisual({ label }: { label: string }) {
  return (
    <div className="category-hero__center-figure">
      <svg width="200" height="150" viewBox="0 0 200 150" style={{ display: 'block', margin: '0 auto' }}>
        <path d="M30 120h140M45 120V70l55-38 55 38v50" fill="rgba(251,191,36,.12)" stroke="rgba(252,211,77,.65)" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="75" y="85" width="50" height="35" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        <circle cx="100" cy="52" r="8" fill="rgba(251,191,36,.5)" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 11, fontWeight: 600, marginTop: 8 }}>{label}</p>
    </div>
  )
}

function GovtBuildingVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="200" height="160" viewBox="0 0 200 160" style={{ display: 'block', margin: '0 auto' }}>
        <path d="M20 140 L100 20 L180 140 Z" fill="rgba(251,191,36,.25)" stroke="rgba(251,191,36,.5)" strokeWidth="2" />
        <rect x="55" y="90" width="90" height="50" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.25)" />
        <rect x="75" y="70" width="50" height="25" fill="rgba(251,191,36,.3)" />
        <circle cx="100" cy="45" r="8" fill="#fbbf24" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, margin: '8px 0 0' }}>
        {GOVT_TAGLINE}
      </p>
    </div>
  )
}

function RailwayVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="240" height="120" viewBox="0 0 240 120">
        <line x1="0" y1="95" x2="240" y2="95" stroke="rgba(255,255,255,.3)" strokeWidth="4" />
        <line x1="0" y1="100" x2="240" y2="100" stroke="rgba(147,197,253,.4)" strokeWidth="2" strokeDasharray="8 6" />
        <rect x="50" y="45" width="140" height="48" rx="8" fill="rgba(96,165,250,.35)" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
        <rect x="65" y="55" width="35" height="28" rx="4" fill="rgba(255,255,255,.15)" />
        <rect x="110" y="55" width="35" height="28" rx="4" fill="rgba(255,255,255,.15)" />
        <rect x="155" y="55" width="25" height="28" rx="4" fill="rgba(255,255,255,.15)" />
        <circle cx="70" cy="98" r="10" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="2" />
        <circle cx="170" cy="98" r="10" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="2" />
      </svg>
    </div>
  )
}

function ExamPrepVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="200" height="140" viewBox="0 0 200 140" style={{ display: 'block', margin: '0 auto' }}>
        <rect x="50" y="20" width="100" height="90" rx="8" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
        <path d="M65 45h70M65 60h50M65 75h60" stroke="rgba(255,255,255,.7)" strokeWidth="3" strokeLinecap="round" />
        <rect x="120" y="75" width="40" height="28" rx="4" fill="rgba(251,191,36,.35)" stroke="rgba(251,191,36,.6)" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 600, marginTop: 8 }}>Exam Prep · Practice · Mock Tests</p>
    </div>
  )
}

function TeachingVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="200" height="140" viewBox="0 0 200 140" style={{ display: 'block', margin: '0 auto' }}>
        <path d="M20 50 L100 25 L180 50 L100 75 Z" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        <path d="M40 55v35c0 12 25 22 60 22s60-10 60-22V55" stroke="rgba(255,255,255,.5)" strokeWidth="2" fill="none" />
        <rect x="85" y="88" width="30" height="36" rx="3" fill="rgba(251,191,36,.25)" stroke="rgba(251,191,36,.5)" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 600, marginTop: 8 }}>KVS · CTET · Faculty Posts</p>
    </div>
  )
}

function DefenceVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="180" height="150" viewBox="0 0 180 150" style={{ display: 'block', margin: '0 auto' }}>
        <path d="M90 15 L155 45 V95 C155 120 125 135 90 140 55 135 25 120 25 95 V45 Z" fill="rgba(74,222,128,.12)" stroke="rgba(134,239,172,.55)" strokeWidth="2.5" />
        <path d="M90 50 L110 70 L90 105 L70 70 Z" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
      </svg>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
        {['Army', 'Navy', 'IAF'].map(b => (
          <span key={b} style={{
            background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.35)',
            color: '#bbf7d0', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800,
          }}>{b}</span>
        ))}
      </div>
    </div>
  )
}

function PoliceVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="160" height="150" viewBox="0 0 160 150" style={{ display: 'block', margin: '0 auto' }}>
        <path d="M80 10 L95 40 H125 L100 58 L108 90 L80 72 L52 90 L60 58 L35 40 H65 Z" fill="rgba(96,165,250,.2)" stroke="rgba(147,197,253,.7)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="80" cy="115" r="22" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.85)', fontSize: 12, fontWeight: 600, marginTop: 10 }}>Protect · Serve · Secure</p>
    </div>
  )
}

function EngineeringVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="200" height="140" viewBox="0 0 200 140" style={{ display: 'block', margin: '0 auto' }}>
        <path d="M30 100h140M50 100V55l50-30 50 30v45" fill="none" stroke="rgba(94,234,212,.6)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="100" cy="48" r="10" fill="rgba(94,234,212,.35)" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
        <path d="M75 100h50v25H75z" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 600, marginTop: 8 }}>JE · AE · Technical Cadre</p>
    </div>
  )
}

function PsuVisual() {
  return (
    <div className="category-hero__center-figure">
      <svg width="200" height="140" viewBox="0 0 200 140">
        <rect x="30" y="50" width="50" height="70" fill="rgba(209,213,219,.2)" stroke="rgba(255,255,255,.25)" />
        <rect x="90" y="30" width="50" height="90" fill="rgba(209,213,219,.25)" stroke="rgba(255,255,255,.3)" />
        <rect x="150" y="60" width="40" height="60" fill="rgba(209,213,219,.18)" stroke="rgba(255,255,255,.2)" />
        <rect x="20" y="120" width="160" height="8" fill="rgba(251,191,36,.4)" rx="2" />
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 600 }}>Industrial · Energy · Infrastructure</p>
    </div>
  )
}
