import{JobsTable}from'@/components/admin/JobsTable'
export default function AdminJobsPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Manage Jobs</h1>
      <JobsTable/>
    </div>
  )
}
