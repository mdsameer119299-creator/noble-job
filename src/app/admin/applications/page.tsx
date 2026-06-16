import { ApplicationsTable } from '@/components/admin/ApplicationsTable'

export default function AdminApplicationsPage() {
  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 26, marginBottom: 24 }}>
        Applications
      </h1>
      <ApplicationsTable />
    </div>
  )
}
