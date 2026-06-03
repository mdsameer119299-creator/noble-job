'use client'
import{useState}from'react'
import{JobPostingsTable}from'@/components/employer/JobPostingsTable'
import{PostJobModal}from'@/components/employer/PostJobModal'
import{Button}from'@/components/ui/Button'
export default function EmployerJobsPage(){
  const[showPost,setShowPost]=useState(false)
  const[refresh,setRefresh]=useState(0)
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26}}>Job Postings</h1>
        <Button variant="primary" onClick={()=>setShowPost(true)}>+ Post New Job</Button>
      </div>
      <JobPostingsTable key={refresh}/>
      <PostJobModal open={showPost} onClose={()=>setShowPost(false)} onPosted={()=>setRefresh(r=>r+1)}/>
    </div>
  )
}
