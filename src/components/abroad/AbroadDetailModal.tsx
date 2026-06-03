'use client'
import{Modal}from'@/components/ui/Modal'
import type{AbroadJob}from'@/types/abroadJob'
interface AbroadDetailModalProps{job:AbroadJob|null;open:boolean;onClose:()=>void}
export function AbroadDetailModal({job,open,onClose}:AbroadDetailModalProps){
  if(!job)return null
  return(
    <Modal open={open} onClose={onClose} maxWidth="680px">
      <div style={{background:'linear-gradient(135deg,#0369a1,#0d1f4e)',padding:'26px 28px',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:22,fontWeight:900,color:'#fff',marginBottom:4}}>{job.title}</h2>
        <p style={{color:'rgba(255,255,255,.8)',marginBottom:12}}>{job.company} · {job.country}</p>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
          {[job.salary,job.experience,job.type].map((v,i)=><span key={i} style={{background:'rgba(255,255,255,.15)',padding:'4px 12px',borderRadius:16,fontSize:12.5,color:'#fff',fontWeight:600}}>{v}</span>)}
        </div>
      </div>
      <div style={{padding:'24px 28px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
          {[{l:'Country',v:job.country},{l:'Location',v:job.location},{l:'Category',v:job.category},{l:'Type',v:job.type},{l:'Experience',v:job.experience},{l:'Salary',v:job.salary}].map((r,i)=>(
            <div key={i} style={{background:'#f0f9ff',borderRadius:10,padding:'10px 14px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>{r.l}</div>
              <div style={{fontWeight:700,color:'#0d1f4e',fontSize:13.5}}>{r.v}</div>
            </div>
          ))}
        </div>
        <p style={{color:'#374151',lineHeight:1.75,marginBottom:20,fontSize:14}}>{job.description}</p>
        {job.skills?.length>0&&(
          <div style={{marginBottom:20}}>
            <h4 style={{fontWeight:800,color:'#0d1f4e',marginBottom:10}}>Required Skills</h4>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {job.skills.map((s:string)=><span key={s} style={{background:'#e0f2fe',color:'#0369a1',border:'1px solid #bae6fd',padding:'5px 12px',borderRadius:18,fontSize:13,fontWeight:600}}>{s}</span>)}
            </div>
          </div>
        )}
        <a href={job.apply_url||'#'} target="_blank" rel="noopener noreferrer" style={{display:'block',background:'linear-gradient(135deg,#0369a1,#0d1f4e)',color:'#fff',padding:'14px',borderRadius:12,fontWeight:900,fontSize:16,textDecoration:'none',textAlign:'center',fontFamily:'Playfair Display,serif'}}>Apply on Official Career Page →</a>
        <p style={{fontSize:11,color:'#9ca3af',textAlign:'center',marginTop:8}}>Noble Job never charges candidates. Visa and work permit info available on the official page.</p>
      </div>
    </Modal>
  )
}
