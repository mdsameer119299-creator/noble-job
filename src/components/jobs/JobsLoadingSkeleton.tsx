import { JobCardSkeleton } from '@/components/ui/Skeleton'

export function JobsLoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
    </div>
  )
}
