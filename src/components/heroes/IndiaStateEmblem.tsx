/** State Emblem of India — official vector, recolored for dark hero (transparent, no box). */
export function IndiaStateEmblem({ className = '' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/emblem-of-india.svg"
      alt="State Emblem of India"
      className={className}
      width={208}
      height={256}
      decoding="async"
    />
  )
}
