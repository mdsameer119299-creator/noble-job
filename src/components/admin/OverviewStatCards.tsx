import type{AdminStats}from'@/types/admin'
interface OverviewStatCardsProps{stats:AdminStats|null}
export function OverviewStatCards({stats}:OverviewStatCardsProps){
  const cards=[
    {l:'Total Live Jobs',v:stats?.liveJobs||0,i:'🟢',c:'#15803d'},
    {l:'Total Verified Jobs',v:stats?.verifiedJobs||0,i:'🔵',c:'#1847d4'},
    {l:'Total Archived Jobs',v:stats?.archivedJobs||0,i:'🗄️',c:'#64748b'},
    {l:'Active Openings',v:stats?.totalJobs||0,i:'💼',c:'#0d1f4e'},
    {l:'Pending Approval',v:stats?.pendingJobs||0,i:'⏳',c:'#f07020'},
    {l:'Verified Employers',v:stats?.totalEmployers||0,i:'🏢',c:'#7c3aed'},
    {l:'Total Candidates',v:stats?.totalCandidates||0,i:'👥',c:'#0369a1'},
    {l:'Applications',v:stats?.totalApplications||0,i:'📋',c:'#059669'},
    {l:'Unread Messages',v:stats?.totalMessages||0,i:'📬',c:'#dc2626'},
  ]
  return(
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
      {cards.map((c,i)=>(
        <div key={i} style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'18px',boxShadow:'0 2px 10px rgba(24,71,212,.05)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <span style={{fontSize:28}}>{c.i}</span>
            <span style={{fontFamily:'Playfair Display,serif',fontSize:28,fontWeight:900,color:c.c}}>{c.v}</span>
          </div>
          <div style={{fontSize:13,color:'#6b7280',fontWeight:600}}>{c.l}</div>
        </div>
      ))}
    </div>
  )
}
