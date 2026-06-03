import { headers } from "next/headers"
import { requireRole } from "@/lib/auth/requireRole"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { ScrollToTop } from "@/components/shared/ScrollToTop"

export async function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") ?? ""
  const isLogin = pathname === "/admin/login"

  if (!isLogin) {
    await requireRole("admin")
    return (
      <div style={{ background: "#f0f4ff", minHeight: "100vh" }}>
        <div
          className="wrap"
          style={{
            paddingTop: 28,
            paddingBottom: 48,
            display: "flex",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          <AdminSidebar />
          <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </div>
        <ScrollToTop />
      </div>
    )
  }

  return <>{children}</>
}
