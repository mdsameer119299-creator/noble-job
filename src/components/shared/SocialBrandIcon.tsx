/** Official brand SVG icons with authentic platform colors */

export type SocialPlatform = 'facebook' | 'instagram' | 'youtube' | 'x' | 'linkedin'

const BRAND: Record<SocialPlatform, { bg: string; color: string }> = {
  facebook: { bg: '#1877F2', color: '#fff' },
  instagram: { bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff' },
  youtube: { bg: '#FF0000', color: '#fff' },
  x: { bg: '#000000', color: '#fff' },
  linkedin: { bg: '#0A66C2', color: '#fff' },
}

function IconPath({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case 'facebook':
      return (
        <path
          fill="currentColor"
          d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        />
      )
    case 'instagram':
      return (
        <path
          fill="currentColor"
          d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.367-.334 2.634-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.367-.062-2.634-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.974-.974 2.241-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.775.13 4.602.402 3.635 1.37 2.668 2.337 2.396 3.51 2.338 4.788 2.28 6.068 2.266 6.477 2.266 12c0 5.523.014 5.932.072 7.212.058 1.278.33 2.451 1.297 3.418.967.967 2.14 1.239 3.418 1.297 1.28.058 1.689.072 7.212.072s5.932-.014 7.212-.072c1.278-.058 2.451-.33 3.418-1.297.967-.967 1.239-2.14 1.297-3.418.058-1.28.072-1.689.072-7.212S23.986 6.068 23.928 4.788c-.058-1.278-.33-2.451-1.297-3.418C21.664 2.403 20.491 2.131 19.213 2.073 17.933 2.015 17.524 2 12 2zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
        />
      )
    case 'youtube':
      return (
        <path
          fill="currentColor"
          d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
        />
      )
    case 'x':
      return (
        <path
          fill="currentColor"
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        />
      )
    case 'linkedin':
      return (
        <path
          fill="currentColor"
          d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.065 2.065 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
        />
      )
  }
}

export function SocialBrandIcon({
  platform,
  size = 36,
  variant = 'circle',
}: {
  platform: SocialPlatform
  size?: number
  variant?: 'circle' | 'plain'
}) {
  const brand = BRAND[platform]
  const iconSize = Math.round(size * 0.52)

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: variant === 'circle' ? '50%' : 10,
        background: brand.bg,
        color: brand.color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
      }}
      aria-hidden
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" role="img">
        <IconPath platform={platform} />
      </svg>
    </span>
  )
}

export const SOCIAL_PLATFORMS: { platform: SocialPlatform; name: string; href: string }[] = [
  { platform: 'facebook', name: 'Facebook', href: 'https://www.facebook.com/noblejobofficial' },
  { platform: 'instagram', name: 'Instagram', href: 'https://www.instagram.com/noblejobofficial' },
  { platform: 'youtube', name: 'YouTube', href: 'https://www.youtube.com/@NOBLEJOBOFFICIAL' },
  { platform: 'x', name: 'X', href: 'https://x.com/noblejoboficial' },
  { platform: 'linkedin', name: 'LinkedIn', href: 'https://www.linkedin.com/company/noblejob' },
]
