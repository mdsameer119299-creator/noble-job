'use client'
import{useState}from'react'
import type{WfhJob}from'@/types/wfhJob'
import{WfhJobCard}from'./WfhJobCard'
import{WfhDetailModal}from'./WfhDetailModal'
interface WfhJobsListProps{jobs:WfhJob[];loading:boolean}
export function WfhJobsList({jobs,loading}:WfhJobsListProps){
  const[selected,setSelected]=useState<WfhJob|null>(null)
  if(loading)return<div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading WFH jobs…</div>
  if(!jobs.length)return<div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>No WFH jobs found for your filters.</div>
  return(
    <>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {jobs.map(j=><WfhJobCard key={j.id} job={j} onClick={setSelected}/>)}
      </div>
      <WfhDetailModal job={selected} open={!!selected} onClose={()=>setSelected(null)}/>
    </>
  )
}
