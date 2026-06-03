'use client'
import{PostJobModal}from'@/components/employer/PostJobModal'
import{useRouter}from'next/navigation'
export default function NewJobPage(){
  const router=useRouter()
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Post a New Job</h1>
      <PostJobModal open={true} onClose={()=>router.push('/employer/jobs')} onPosted={()=>router.push('/employer/jobs')}/>
    </div>
  )
}
