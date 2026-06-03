interface StatCard{label:string;value:number|string;icon:string;color:string}
interface StatCardsProps{stats:{activeJobs:number;applications:number;shortlisted:number;interviews:number;hired:number}|null}
export function StatCards({stats}:StatCardsProps){
  const cards:StatCard[]=[
    {label:'Active Jobs',value:stats?.activeJobs||0,icon:'💼',color:'#1847d4'},
    {label:'Applications',value:stats?.applications||0,icon:'📋',color:'#7c3aed'},
    {label:'Shortlisted',value:stats?.shortlisted||0,icon:'⭐',color:'#f07020'},
    {label:'Interviews',value:stats?.interviews||0,icon:'📅',color:'#0369a1'},
    {label:'Hired',value:stats?.hired||0,icon:'🏆',color:'#15803d'},
  ]
  return(
    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:24}}>
      {cards.map((c,i)=>(
        <div key={i} style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'18px 16px',textAlign:'center',boxShadow:'0 2px 10px rgba(24,71,212,.05)'}}>
          <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:28,fontWeight:900,color:c.color}}>{c.value}</div>
          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginTop:2}}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}
