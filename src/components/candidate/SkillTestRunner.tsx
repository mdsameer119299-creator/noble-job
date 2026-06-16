'use client'
import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState, EmptyState, ErrorState, PanelCard } from './AsyncStates'

type RawQuestion = Record<string, unknown>
type Question = { question: string; options: string[]; answer: number }
type Test = {
  id: string
  title: string
  passing_score: number | null
  questions_json: RawQuestion[] | unknown
}

/** Defensively normalise an unknown questions_json shape into renderable MCQs. */
function normalize(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return []
  const out: Question[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as RawQuestion
    const question = String(o.question ?? o.q ?? o.text ?? '')
    const options = (o.options ?? o.choices ?? o.answers) as unknown
    const answerRaw = o.answer ?? o.correct ?? o.correctIndex
    if (!question || !Array.isArray(options) || options.length === 0) continue
    out.push({
      question,
      options: options.map((x) => String(x)),
      answer: typeof answerRaw === 'number' ? answerRaw : -1,
    })
  }
  return out
}

export function SkillTestRunner() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)
  const { data, loading, error, reload } = useAsyncData<Test>(id ? `/api/skill-tests/${id}` : null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null)
  const toast = useToast()

  const questions = useMemo(() => normalize(data?.questions_json), [data])

  if (loading) return <LoadingState label="Loading test…" />
  if (error) return <ErrorState onRetry={reload} message={error} />
  if (!data) return <EmptyState message="Test not found." />
  if (questions.length === 0) return <EmptyState message="This test has no questions yet." />

  const submit = async () => {
    setSubmitting(true)
    try {
      const correct = questions.reduce((n, q, i) => (answers[i] === q.answer ? n + 1 : n), 0)
      const score = Math.round((correct / questions.length) * 100)
      const res = await fetch(`/api/skill-tests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, score }),
      })
      if (!res.ok) {
        toast.error('Could not submit test')
        return
      }
      const passing = data.passing_score ?? 70
      setResult({ score, passed: score >= passing })
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <PanelCard>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 18, marginBottom: 8 }}>
          {result.passed ? 'Passed 🎉' : 'Keep practising'}
        </h3>
        <p style={{ fontSize: 14, color: '#374151' }}>Your score: <strong>{result.score}%</strong></p>
      </PanelCard>
    )
  }

  const allAnswered = questions.every((_, i) => answers[i] !== undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      {questions.map((q, i) => (
        <PanelCard key={i}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0d1f4e', marginBottom: 10 }}>
            {i + 1}. {q.question}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, oi) => (
              <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`q${i}`}
                  checked={answers[i] === oi}
                  onChange={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                />
                {opt}
              </label>
            ))}
          </div>
        </PanelCard>
      ))}
      <button
        type="button"
        onClick={submit}
        disabled={submitting || !allAnswered}
        style={{ background: allAnswered ? '#1847d4' : '#94a3b8', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 800, cursor: submitting || !allAnswered ? 'not-allowed' : 'pointer' }}
      >
        {submitting ? 'Submitting…' : 'Submit test'}
      </button>
    </div>
  )
}
