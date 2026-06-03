// HeroSection — responsive: desktop 3-col grid, mobile stacked layout
import Image from 'next/image'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="relative z-[1] overflow-hidden bg-[#deeaf8] min-h-[520px] lg:h-[560px]">
      {/* Background image */}
      <Image
        src="/images/hero-professionals.png"
        alt="Noble Job professionals"
        fill
        priority
        className="object-cover object-[65%_center] z-0 lg:object-center lg:scale-[0.92] lg:origin-right"
        sizes="100vw"
      />

      {/* Gradient overlay — stronger on left so headline never sits on photo */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(222,234,248,1) 0%, rgba(222,234,248,1) 18%, rgba(222,234,248,.95) 28%, rgba(222,234,248,.75) 40%, rgba(222,234,248,.25) 52%, transparent 62%)',
        }}
      />
      <div
        className="absolute inset-0 z-[1] pointer-events-none lg:hidden"
        style={{
          background: 'linear-gradient(to bottom, rgba(222,234,248,.92) 0%, rgba(222,234,248,.75) 45%, transparent 72%)',
        }}
      />

      {/* Decorative orbs */}
      <div
        className="absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none z-[1] hidden lg:block"
        style={{ background: 'radial-gradient(circle, rgba(24,71,212,.08) 0%, transparent 65%)' }}
      />
      <div
        className="absolute bottom-[-60px] left-[200px] w-[300px] h-[300px] rounded-full pointer-events-none z-[1] hidden lg:block"
        style={{ background: 'radial-gradient(circle, rgba(24,71,212,.06) 0%, transparent 70%)' }}
      />

      {/* Content */}
      <div className="relative z-[2] w-full flex items-center py-10 lg:absolute lg:inset-0 lg:py-0">
        <div className="w-full max-w-[1360px] mx-auto px-6 sm:px-8 lg:px-12 grid grid-cols-1 gap-8 lg:gap-0 items-center lg:grid-cols-[minmax(0,460px)_1fr_minmax(0,320px)]">
            {/* LEFT: Headline + sub + CTAs */}
            <div className="relative z-10 max-w-xl lg:max-w-none">
              <h1
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 'clamp(36px,5vw,58px)',
                  fontWeight: 900,
                  lineHeight: 1.08,
                  letterSpacing: '-.03em',
                  color: '#0d1f4e',
                  marginBottom: 18,
                }}
              >
                Find The Right Job
                <em
                  style={{
                    fontStyle: 'italic',
                    color: '#1847d4',
                    display: 'block',
                    fontSize: 'clamp(40px,5.5vw,64px)',
                  }}
                >
                  Build Your Bright Future
                </em>
              </h1>

              <p
                style={{
                  fontSize: 18,
                  color: '#0d1f4e',
                  lineHeight: 1.65,
                  margin: '0 0 28px',
                  maxWidth: 400,
                  fontWeight: 400,
                }}
              >
                Explore thousands of verified jobs from top companies and government organizations.
              </p>

              <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
                <Link
                  href="/jobs/private"
                  className="no-underline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#1847d4',
                    color: '#fff',
                    padding: '14px 26px',
                    borderRadius: 12,
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: 16,
                    fontWeight: 700,
                    boxShadow: '0 4px 18px rgba(24,71,212,.35)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24" width={18} height={18}>
                    <path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM9 4h6v2H9V4z" />
                  </svg>
                  Find Jobs
                </Link>

                <Link
                  href="/auth?role=candidate&tab=register"
                  className="no-underline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#fff',
                    color: '#0d1f4e',
                    padding: '13px 24px',
                    borderRadius: 12,
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: 16,
                    fontWeight: 700,
                    border: '2px solid #b8cde4',
                    boxShadow: '0 2px 8px rgba(13,31,78,.08)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24" width={18} height={18}>
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
                  </svg>
                  Upload CV
                </Link>

                <Link
                  href="/contact"
                  className="no-underline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'transparent',
                    color: '#0d1f4e',
                    padding: '13px 20px',
                    borderRadius: 12,
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: 16,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24" width={18} height={18} style={{ color: '#1847d4' }}>
                    <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                  </svg>
                  How It Works
                </Link>
              </div>
            </div>

            {/* CENTER: image visible between columns (desktop only) */}
            <div className="hidden lg:block min-h-[1px]" aria-hidden />

            {/* RIGHT: AI CV Score Card */}
            <div className="relative z-10 flex justify-center lg:justify-end w-full">
              <div
                style={{
                  background: '#fff',
                  borderRadius: 18,
                  padding: '24px 26px 22px',
                  boxShadow: '0 10px 40px rgba(13,31,78,.16)',
                  border: '1px solid rgba(13,31,78,.07)',
                  width: '100%',
                  maxWidth: 290,
                  transform: 'translateY(-15px)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"Playfair Display", serif',
                      fontSize: 19,
                      fontWeight: 800,
                      color: '#0d1f4e',
                      letterSpacing: '-.01em',
                    }}
                  >
                    AI CV Score
                  </span>
                  <span
                    style={{
                      background: '#1847d4',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '5px 13px',
                      borderRadius: 100,
                      letterSpacing: '.08em',
                    }}
                  >
                    New
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                  <div style={{ position: 'relative', width: 124, height: 124 }}>
                    <svg viewBox="0 0 110 110" width={124} height={124}>
                      <circle cx={55} cy={55} r={44} fill="none" stroke="#e2eaf8" strokeWidth={10} />
                      <circle
                        cx={55}
                        cy={55}
                        r={44}
                        fill="none"
                        stroke="#1847d4"
                        strokeWidth={10}
                        strokeLinecap="round"
                        strokeDasharray="276.5"
                        strokeDashoffset="49.8"
                        transform="rotate(-90 55 55)"
                      />
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%,-50%)',
                        textAlign: 'center',
                        lineHeight: 1,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: '"Playfair Display", serif',
                          fontSize: 34,
                          fontWeight: 900,
                          color: '#0d1f4e',
                        }}
                      >
                        82%
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#15803d',
                          letterSpacing: '.04em',
                          marginTop: 4,
                        }}
                      >
                        Excellent Match
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 18 }}>
                  {[
                    { label: 'Skills Match', w: 88 },
                    { label: 'Experience', w: 76 },
                    { label: 'Education', w: 68 },
                  ].map(row => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 15,
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          fontWeight: 700,
                          color: '#0d1f4e',
                        }}
                      >
                        <svg fill="currentColor" viewBox="0 0 24 24" width={15} height={15} style={{ color: '#15803d' }}>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                        {row.label}
                      </span>
                      <div style={{ width: 88, height: 7, background: '#dce6f4', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: 7,
                            borderRadius: 4,
                            background: 'linear-gradient(90deg,#1847d4,#4f8ef7)',
                            width: `${row.w}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/auth?role=candidate"
                  className="no-underline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#1847d4',
                    fontFamily: '"Playfair Display", serif',
                    letterSpacing: '-.01em',
                    paddingTop: 15,
                    borderTop: '1px solid #e8eef8',
                  }}
                >
                  Improve Your CV
                  <svg fill="currentColor" viewBox="0 0 24 24" width={13} height={13}>
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                  </svg>
                </Link>
              </div>
            </div>
        </div>
      </div>
    </section>
  )
}
