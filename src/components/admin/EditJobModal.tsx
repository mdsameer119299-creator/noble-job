// Admin job edit modal — lightweight inline form
'use client'
interface EditJobModalProps { [key: string]: any }
export function EditJobModal(props: EditJobModalProps) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <h3 style={{ fontFamily: '"Playfair Display",serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 12 }}>✏️ Edit Job</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Select a job from the table above to edit it.</p>
    </div>
  )
}
