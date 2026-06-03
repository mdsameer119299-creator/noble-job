// Admin job detail view — different from public JobDetailModal
'use client'
interface JobDetailModalProps { [key: string]: any }
export function JobDetailModal(props: JobDetailModalProps) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <h3 style={{ fontFamily: '"Playfair Display",serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 12 }}>📋 Job Detail</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Click a job to view its details.</p>
    </div>
  )
}
