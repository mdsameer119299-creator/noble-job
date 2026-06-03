import type { Metadata } from "next"
import { AdminLayoutShell } from "@/components/admin/AdminLayoutShell"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Admin — Noble Job",
}

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>
}
