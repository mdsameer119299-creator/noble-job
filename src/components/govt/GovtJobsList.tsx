'use client'
import type{GovtJob}from'@/types/govtJob'
import{GovtJobListCard}from'./GovtJobListCard'
interface GovtJobsListProps{jobs:GovtJob[];loading:boolean;q:string}
export function GovtJobsList({jobs,loading,q}:GovtJobsListProps){
  const filtered=q?jobs.filter(j=>j.title.toLowerCase().includes(q.toLowerCase())||j.org.toLowerCase().includes(q.toLowerCase())):jobs
  if(loading)return<div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading govt jobs…</div>
  if(!filtered.length)return<div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>No government jobs found.</div>
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {filtered.map(j=><GovtJobListCard key={j.id} job={j}/>)}
    </div>
  )
}
