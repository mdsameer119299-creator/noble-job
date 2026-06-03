'use client'
import { JOB_CATEGORIES, EXPERIENCE_LEVELS } from '@/lib/constants/jobCategories'
interface CandidateRegisterStep2Props { form: any; onChange: (k: string, v: any) => void; errors: any }
const POPULAR_SKILLS = ['JavaScript','Python','Java','React','SQL','Excel','Communication','Leadership','Digital Marketing','Data Analysis','Customer Service','Teaching','Accounting','Design','HR']
export function CandidateRegisterStep2({ form, onChange, errors }: CandidateRegisterStep2Props) {
  const skills = (form.skills || []) as string[]
  const toggle = (s: string) => onChange('skills', skills.includes(s) ? skills.filter((x: string) => x !== s) : [...skills, s])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Job Category</label>
        <select value={form.category || ''} onChange={e => onChange('category', e.target.value)}
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
          <option value="">Select your field</option>
          {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Experience Level</label>
        <select value={form.experienceYears || ''} onChange={e => onChange('experienceYears', e.target.value)}
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
          <option value="">Select experience</option>
          {EXPERIENCE_LEVELS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 10 }}>Your Skills <span style={{ color: '#9ca3af', fontWeight: 400 }}>(select all that apply)</span></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {POPULAR_SKILLS.map(s => (
            <button key={s} type="button" onClick={() => toggle(s)}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all .2s', borderColor: skills.includes(s) ? '#1847d4' : '#e2e8f0', background: skills.includes(s) ? '#eff6ff' : '#fff', color: skills.includes(s) ? '#1847d4' : '#374151' }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
