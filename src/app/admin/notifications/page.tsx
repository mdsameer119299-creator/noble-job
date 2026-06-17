import { AdminNotifications } from '@/components/admin/AdminNotifications'

export default function AdminNotificationsPage() {
  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 26, marginBottom: 24 }}>
        Notifications
      </h1>
      <AdminNotifications />
    </div>
  )
}
