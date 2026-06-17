import { AiResumeSearch } from '@/components/employer/AiResumeSearch'

export default function EmployerFindCandidatesPage() {
  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 26, marginBottom: 24 }}>
        Find Candidates
      </h1>
      <AiResumeSearch />
    </div>
  )
}
