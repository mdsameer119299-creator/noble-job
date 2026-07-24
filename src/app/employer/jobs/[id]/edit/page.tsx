import{Suspense}from'react'
import{EditJobModal}from'@/components/employer/EditJobModal'
export default function EditJobPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Edit Job</h1>
      <Suspense fallback={<p style={{color:'#6b7280',fontSize:13}}>Loading job…</p>}>
        <EditJobModal/>
      </Suspense>
    </div>
  )
}
