interface WfhSkillTagsProps {
  skills: string[]
}

export function WfhSkillTags({ skills }: WfhSkillTagsProps) {
  if (!skills?.length) return null
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {skills.slice(0, 4).map(s => (
        <span key={s} className="wfh-skill-tag">{s}</span>
      ))}
    </div>
  )
}
