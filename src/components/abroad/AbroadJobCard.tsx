'use client'
import{useState}from'react'
import type{AbroadJob}from'@/types/abroadJob'
import{JobStatusBadge}from'@/components/shared/JobStatusBadge'
import{isActiveStatus,ARCHIVED_ALT_LABEL,nonGenuineListingLabel}from'@/lib/config/jobStrategy'
import{classifyProvenance,isGenuine}from'@/lib/jobs/provenance'
import{isActionableJob,displayValue}from'@/lib/jobs/renderable'
import{applyStateFor}from'@/lib/jobs/applyRoute'
import{ApplicationModal}from'@/components/jobs/ApplicationModal'
interface AbroadJobCardProps{job:AbroadJob;onClick:(j:AbroadJob)=>void}
export function AbroadJobCard({job,onClick}:AbroadJobCardProps){
  const isArchived=job.jobStatus==='ARCHIVED_JOB'
  const genuine=isGenuine(job)
  // Same gate as the Private board's JobCard / the fixed WfhJobCard: only a
  // currently-open, genuine, EMPLOYER-OWNED job may show "Apply Now" directly
  // on the card. A sourced/aggregated listing keeps "View Details" — honest,
  // never a fake apply action.
  const isSample=classifyProvenance(job)==='SYNTHETIC'
  const apply=applyStateFor('abroad',job,job.company)
  const canApply=isActiveStatus(job.jobStatus)&&!isSample&&apply.kind==='employer'&&isActionableJob(job,'abroad')
  const[applyOpen,setApplyOpen]=useState(false)
  const[applied,setApplied]=useState(false)
  return(
    <>
    <div onClick={()=>onClick(job)} style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'16px 18px',cursor:'pointer',transition:'all .2s',boxShadow:'0 2px 10px rgba(3,105,161,.06)'}} className="hover:shadow-card-hover hover:-translate-y-0.5">
      <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12}}>
        <div style={{width:50,height:50,borderRadius:10,background:'#0369a1',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,flexShrink:0}}>{job.logo||String(job.company??'').slice(0,2).toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
            <div style={{fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:15,color:'#0d1f4e',lineHeight:1.3}}>{job.title}</div>
            <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
              {job.jobStatus&&<JobStatusBadge status={!genuine&&!isArchived?'ARCHIVED_JOB':job.jobStatus} label={!genuine&&!isArchived?nonGenuineListingLabel(job):isArchived&&parseInt(job.id.replace(/\D/g,''),10)%2===0?ARCHIVED_ALT_LABEL:undefined}/>}
              {!isArchived&&genuine&&job.badge&&<span style={{background:'#0369a1',color:'#fff',padding:'3px 9px',borderRadius:12,fontSize:11,fontWeight:800,flexShrink:0}}>{job.badge}</span>}
            </div>
          </div>
          <div style={{fontSize:12.5,color:'#6b7280',marginTop:2}}>{job.company}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:10}}>
        {[{i:'🌍',v:displayValue(job.country)},{i:'📍',v:displayValue(job.location)},{i:'💰',v:displayValue(job.salary)},{i:'📊',v:displayValue(job.experience)}].filter(t=>t.v).map((t,i)=>(
          <span key={i} style={{background:'#e0f2fe',color:'#0369a1',padding:'4px 10px',borderRadius:18,fontSize:12,fontWeight:600}}>{t.i} {t.v}</span>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:12,color:'#9ca3af'}}>{isArchived?'🗄 Archived Vacancy':!genuine?`📄 ${nonGenuineListingLabel(job)}`:displayValue(job.category)?`📂 ${displayValue(job.category)}`:''}</span>
        {canApply?(
          <button type="button" disabled={applied} onClick={e=>{e.stopPropagation();setApplyOpen(true)}}
            style={{background:applied?'#15803d':'#0369a1',color:'#fff',border:'none',padding:'7px 16px',borderRadius:8,fontWeight:800,fontSize:12.5,cursor:applied?'not-allowed':'pointer'}}>
            {applied?'Applied ✓':'Apply Now →'}
          </button>
        ):(
          <button type="button" style={{background:isArchived?'#f1f5f9':'#0369a1',color:isArchived?'#64748b':'#fff',border:isArchived?'1.5px solid #cbd5e1':'none',padding:'7px 16px',borderRadius:8,fontWeight:800,fontSize:12.5,cursor:'pointer'}}>View Details</button>
        )}
      </div>
    </div>

    {/* Rendered as a sibling, not a child of the onClick'd card above — a portaled
        ApplicationModal's clicks still bubble through the REACT tree, so nesting it
        inside the card would also re-fire the card's onClick and pop the detail
        modal open behind/above it. */}
    <ApplicationModal
      open={applyOpen}
      onClose={()=>setApplyOpen(false)}
      jobId={job.id}
      board="abroad"
      title={job.title}
      company={job.company}
      location={job.location||job.country}
      salary={job.salary}
      onApplied={()=>setApplied(true)}
    />
    </>
  )
}
