'use client'
import{Modal}from'@/components/ui/Modal'
import type{WfhJob}from'@/types/wfhJob'
import{WfhSkillTags}from'./WfhSkillTags'
import{ApplyButton}from'@/components/jobs/ApplyButton'
import{applyStateFor}from'@/lib/jobs/applyRoute'
import{displayValue}from'@/lib/jobs/renderable'
interface WfhDetailModalProps{job:WfhJob|null;open:boolean;onClose:()=>void}
export function WfhDetailModal({job,open,onClose}:WfhDetailModalProps){
  if(!job)return null
  // The honest apply state (employer-delivered / external source / sample / closed / info only) —
  // the same one the detail page and JobPosting use. Only the employer route opens NobleJob's flow.
  const apply=applyStateFor('wfh',job,job.company)
  return(
    <Modal open={open} onClose={onClose} maxWidth="680px">
      <div style={{background:`linear-gradient(135deg,${job.color||'#7c3aed'},#0d1f4e)`,padding:'28px 28px 24px',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>×</button>
        <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
          <div style={{width:56,height:56,borderRadius:12,background:'rgba(255,255,255,.15)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,flexShrink:0}}>{job.logo||String(job.company??'').slice(0,2).toUpperCase()}</div>
          <div>
            <h2 style={{fontFamily:'Playfair Display,serif',fontWeight:900,fontSize:22,color:'#fff',marginBottom:4}}>{job.title}</h2>
            <p style={{color:'rgba(255,255,255,.8)',marginBottom:12}}>{[job.company,displayValue(job.cat)].filter(Boolean).join(' · ')}</p>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              {[displayValue(job.type),displayValue(job.experience),displayValue(job.salary)].filter(Boolean).map((v,i)=><span key={i} style={{background:'rgba(255,255,255,.15)',padding:'4px 12px',borderRadius:18,fontSize:12.5,color:'#fff',fontWeight:600}}>{v}</span>)}
            </div>
          </div>
        </div>
      </div>
      <div style={{padding:'24px 28px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
          {[{l:'🎓 Qualification',v:displayValue(job.qualification)},{l:'📂 Category',v:displayValue(job.cat)},{l:'👤 Applicants',v:Number.isFinite(job.applicants)&&job.applicants>0?job.applicants+' Applied':undefined},{l:'💰 Salary',v:displayValue(job.salary)}].filter(r=>r.v).map((r,i)=>(
            <div key={i} style={{background:'#f8faff',borderRadius:10,padding:'12px 14px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{r.l}</div>
              <div style={{fontWeight:700,color:'#0d1f4e',fontSize:14}}>{r.v}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:18}}>
          <h4 style={{fontWeight:800,color:'#0d1f4e',marginBottom:10}}>Job Description</h4>
          <p style={{color:'#374151',lineHeight:1.75,fontSize:14}}>{job.description}</p>
        </div>
        <div style={{marginBottom:22}}><h4 style={{fontWeight:800,color:'#0d1f4e',marginBottom:10}}>Required Skills</h4><WfhSkillTags skills={job.skills}/></div>
        <ApplyButton jobId={job.id} board="wfh" state={apply} title={job.title} company={job.company} salary={job.salary} block/>
      </div>
    </Modal>
  )
}
