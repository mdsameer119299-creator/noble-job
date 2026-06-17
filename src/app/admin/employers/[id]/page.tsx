import { AdminEmployerDetail } from '@/components/admin/AdminEmployerDetail'

export default async function AdminEmployerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 26, marginBottom: 24 }}>
        Employer Detail
      </h1>
      <AdminEmployerDetail id={id} />
    </div>
  )
}
