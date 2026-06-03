import{EmployerTable}from'@/components/admin/EmployerTable'
export default function AdminEmployersPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Manage Employers</h1>
      <EmployerTable/>
    </div>
  )
}
