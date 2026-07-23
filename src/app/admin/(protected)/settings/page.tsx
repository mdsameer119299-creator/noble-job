import{SettingsForm}from'@/components/admin/SettingsForm'
import{SyntheticJobsToggle}from'@/components/admin/SyntheticJobsToggle'
export default function AdminSettingsPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Admin Settings</h1>
      <SyntheticJobsToggle/>
      <SettingsForm/>
    </div>
  )
}
