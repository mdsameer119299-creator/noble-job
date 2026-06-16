import { SkillTestsList } from '@/components/candidate/SkillTestsList'

export default function CandidateSkillTestsPage() {
  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 26, marginBottom: 24 }}>
        Skill Tests
      </h1>
      <SkillTestsList />
    </div>
  )
}
