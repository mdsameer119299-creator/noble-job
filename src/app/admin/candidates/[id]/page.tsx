import { CandidateDetail } from '@/components/admin/CandidateDetail'

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 26, marginBottom: 24 }}>
        Candidate Detail
      </h1>
      <CandidateDetail id={id} />
    </div>
  )
}
