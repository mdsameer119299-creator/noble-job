export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import{requireRole}from'@/lib/auth/requireRole'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import{CandidateSidebar}from'@/components/candidate/CandidateSidebar'
import{ScrollToTop}from'@/components/shared/ScrollToTop'
export default async function CandidateLayout({children}:{children:React.ReactNode}){
  await requireRole('candidate')
  return(
    <div style={{background:'#f8faff',minHeight:'100vh'}}>
      <div className="wrap dashboard-shell" style={{paddingTop:28,paddingBottom:48}}>
        <CandidateSidebar/>
        <div style={{flex:1,minWidth:0,width:'100%'}}>{children}</div>
      </div>
      <ScrollToTop/>
    </div>
  )
}
