'use client'
import{useState}from'react'
import{Modal}from'@/components/ui/Modal'
import type{WfhJob}from'@/types/wfhJob'
import{WfhSkillTags}from'./WfhSkillTags'
import{ApplicationModal}from'@/components/jobs/ApplicationModal'
import{classifyProvenance}from'@/lib/jobs/provenance'
interface WfhDetailModalProps{job:WfhJob|null;open:boolean;onClose:()=>void}
export function WfhDetailModal({job,open,onClose}:WfhDetailModalProps){
  const[applyOpen,setApplyOpen]=useState(false)
  const[applied,setApplied]=useState(false)
  if(!job)return null
  // Generated demo (SYNTHETIC) rows cannot take applications — see ApplyButton.
  const sample=classifyProvenance(job)==='SYNTHETIC'
  return(
    <Modal open={open} onClose={onClose} maxWidth="680px">
      <div style={{background:`linear-gradient(135deg,${job.color||'#7c3aed'},#0d1f4e)`,padding:'28px 28px 24px',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>×</button>
        <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
          <div style={{width:56,height:56,borderRadius:12,background:'rgba(255,255,255,.15)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,flexShrink:0}}>{job.logo||job.company.slice(0,2).toUpperCase()}</div>
          <div>
            <h2 style={{fontFamily:'Playfair Display,serif',fontWeight:900,fontSize:22,color:'#fff',marginBottom:4}}>{job.title}</h2>
            <p style={{color:'rgba(255,255,255,.8)',marginBottom:12}}>{job.company} · {job.cat}</p>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              {[job.type,job.experience,job.salary].map((v,i)=><span key={i} style={{background:'rgba(255,255,255,.15)',padding:'4px 12px',borderRadius:18,fontSize:12.5,color:'#fff',fontWeight:600}}>{v}</span>)}
            </div>
          </div>
        </div>
      </div>
      <div style={{padding:'24px 28px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
          {[{l:'🎓 Qualification',v:job.qualification},{l:'📂 Category',v:job.cat},{l:'👤 Applicants',v:job.applicants+' Applied'},{l:'💰 Salary',v:job.salary}].map((r,i)=>(
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
        {sample?(<>
          <button type="button" disabled aria-disabled="true" style={{display:'block',width:'100%',background:'#e2e8f0',color:'#64748b',padding:'14px',borderRadius:12,fontWeight:900,fontSize:16,border:'none',cursor:'not-allowed',fontFamily:'Playfair Display,serif'}}>Sample listing — applications closed</button>
          <p style={{fontSize:12,color:'#64748b',textAlign:'center',marginTop:8,lineHeight:1.55}}>This is a sample listing shown for reference. The role and company are illustrative, not a confirmed vacancy, and no application can be submitted.</p>
        </>):(<>
        <button type="button" onClick={()=>setApplyOpen(true)} disabled={applied} style={{display:'block',width:'100%',background:applied?'#15803d':'linear-gradient(135deg,#1847d4,#7c3aed)',color:'#fff',padding:'14px',borderRadius:12,fontWeight:900,fontSize:16,border:'none',cursor:applied?'not-allowed':'pointer',fontFamily:'Playfair Display,serif'}}>{applied?'Applied ✓':'Apply Now →'}</button>
        <p style={{fontSize:11,color:'#9ca3af',textAlign:'center',marginTop:8}}>Noble Job never charges candidates. Your application stays on Noble Job.</p>
        </>)}
      </div>
      <ApplicationModal open={applyOpen} onClose={()=>setApplyOpen(false)} jobId={job.id} board="wfh" title={job.title} company={job.company} salary={job.salary} sourceUrl={job.apply_url} source={job.company} onApplied={()=>setApplied(true)}/>
    </Modal>
  )
}
