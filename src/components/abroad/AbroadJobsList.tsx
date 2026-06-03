'use client'
import{useState}from'react'
import type{AbroadJob}from'@/types/abroadJob'
import{AbroadJobCard}from'./AbroadJobCard'
import{AbroadDetailModal}from'./AbroadDetailModal'
interface AbroadJobsListProps{jobs:AbroadJob[];loading:boolean}
export function AbroadJobsList({jobs,loading}:AbroadJobsListProps){
  const[selected,setSelected]=useState<AbroadJob|null>(null)
  if(loading)return<div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading abroad jobs…</div>
  if(!jobs.length)return<div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>No abroad jobs found.</div>
  return(
    <>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {jobs.map(j=><AbroadJobCard key={j.id} job={j} onClick={setSelected}/>)}
      </div>
      <AbroadDetailModal job={selected} open={!!selected} onClose={()=>setSelected(null)}/>
    </>
  )
}
