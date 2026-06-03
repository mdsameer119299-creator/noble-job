export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import{requireRole}from'@/lib/auth/requireRole'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import{EmployerSidebar}from'@/components/employer/EmployerSidebar'
import{ScrollToTop}from'@/components/shared/ScrollToTop'
export default async function EmployerLayout({children}:{children:React.ReactNode}){
  await requireRole('employer')
  return(
    <div style={{background:'#f8faff',minHeight:'100vh'}}>
      <div className="wrap dashboard-shell" style={{paddingTop:28,paddingBottom:48}}>
        <EmployerSidebar/>
        <div style={{flex:1,minWidth:0,width:'100%'}}>{children}</div>
      </div>
      <ScrollToTop/>
    </div>
  )
}
