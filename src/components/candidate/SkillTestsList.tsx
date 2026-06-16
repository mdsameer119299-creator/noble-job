'use client'
import Link from 'next/link'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState, EmptyState, ErrorState } from './AsyncStates'

type Test = {
  id: string
  title: string
  category: string | null
  duration_mins: number | null
  passing_score: number | null
}

export function SkillTestsList() {
  const { data, loading, error, reload } = useAsyncData<Test[]>('/api/skill-tests')

  if (loading) return <LoadingState label="Loading skill tests…" />
  if (error) return <ErrorState onRetry={reload} message={error} />
  const tests = data || []
  if (tests.length === 0) return <EmptyState message="No skill tests are available yet. Check back soon." />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
      {tests.map((t) => (
        <Link
          key={t.id}
          href={`/candidate/skill-tests/${t.id}`}
          style={{ textDecoration: 'none' }}
        >
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0d1f4e', marginBottom: 6 }}>{t.title}</div>
            {t.category && <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700, marginBottom: 8 }}>{t.category}</div>}
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {t.duration_mins ? `${t.duration_mins} min` : ''}
              {t.duration_mins && t.passing_score ? ' · ' : ''}
              {t.passing_score ? `Pass ${t.passing_score}%` : ''}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: '#1847d4' }}>Start test →</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
