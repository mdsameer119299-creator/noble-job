import{CandidateTable}from'@/components/admin/CandidateTable'
export default function AdminCandidatesPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Manage Candidates</h1>
      <CandidateTable/>
    </div>
  )
}
