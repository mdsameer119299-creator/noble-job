'use client'
import type{GovtJob}from'@/types/govtJob'
interface GovtJobCardProps{job:GovtJob;onClick:(j:GovtJob)=>void}
export function GovtJobCard({job,onClick}:GovtJobCardProps){
  return(
    <div onClick={()=>onClick(job)} style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'16px 18px',cursor:'pointer',transition:'all .2s',boxShadow:'0 2px 10px rgba(24,71,212,.05)'}} className="hover:shadow-card-hover hover:-translate-y-0.5">
      <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12}}>
        <div style={{width:48,height:48,borderRadius:10,background:job.color||'#1847d4',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,flexShrink:0,textAlign:'center',lineHeight:1.2}}>{job.short}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
            <div style={{fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:15,color:'#0d1f4e',lineHeight:1.3}}>{job.title}</div>
            {job.badge&&<span style={{background:'#1847d4',color:'#fff',padding:'3px 9px',borderRadius:12,fontSize:11,fontWeight:800,flexShrink:0}}>{job.badge}</span>}
          </div>
          <div style={{fontSize:12.5,color:'#6b7280',marginTop:2}}>{job.org}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
        {[{l:'👤 '+job.vacancies+' Vacancies'},{l:'📍 '+job.location},{l:'📅 Last: '+job.last_date},{l:'💰 '+job.salary}].filter(t=>t.l&&!t.l.includes('undefined')).map((t,i)=>(
          <span key={i} style={{background:'#f0f4ff',color:'#374151',padding:'4px 10px',borderRadius:18,fontSize:12,fontWeight:600}}>{t.l}</span>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:12,color:'#9ca3af'}}>🎓 {job.qualification}</span>
        <button style={{background:'#1847d4',color:'#fff',border:'none',padding:'7px 16px',borderRadius:8,fontWeight:800,fontSize:12.5,cursor:'pointer'}}>View Details</button>
      </div>
    </div>
  )
}
