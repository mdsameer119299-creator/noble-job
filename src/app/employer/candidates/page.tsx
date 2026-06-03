import{AppStatusTabs}from'@/components/employer/AppStatusTabs'
export default function EmployerCandidatesPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Applications</h1>
      <AppStatusTabs/>
    </div>
  )
}
