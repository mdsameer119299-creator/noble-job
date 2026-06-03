import Image from 'next/image'

/** Circular Noble Job logo mark — original brand asset. */
export function NobleJobLogoMark({ size = 70, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/images/noble-job-logo.png"
      alt="Noble Job"
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
      priority
    />
  )
}
