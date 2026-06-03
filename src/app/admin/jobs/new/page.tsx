import{AdminPostJobForm}from'@/components/admin/AdminPostJobForm'
export default function AdminJobFormPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Manage Job</h1>
      <AdminPostJobForm/>
    </div>
  )
}
