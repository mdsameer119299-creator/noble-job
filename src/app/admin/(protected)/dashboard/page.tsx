import{getAdminStats}from'@/lib/services/adminService'
import{OverviewStatCards}from'@/components/admin/OverviewStatCards'
import{TrendChart}from'@/components/admin/TrendChart'
import{PendingMiniList}from'@/components/admin/PendingMiniList'
export default async function AdminDashboardPage(){
  const stats=await getAdminStats().catch(()=>null)
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:28,marginBottom:24}}>🛡️ Admin Dashboard</h1>
      <OverviewStatCards stats={stats}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:24}}>
        <TrendChart/>
        <PendingMiniList/>
      </div>
    </div>
  )
}
