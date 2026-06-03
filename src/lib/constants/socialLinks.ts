/**
 * Official Noble Job social media URLs.
 */
export const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/noblejobofficial',
  instagram: 'https://www.instagram.com/noblejobofficial',
  youtube: 'https://www.youtube.com/@NOBLEJOBOFFICIAL',
  x: 'https://x.com/noblejoboficial',
  linkedin: 'https://www.linkedin.com/company/noblejob',
} as const

export type SocialPlatform = keyof typeof SOCIAL_LINKS
