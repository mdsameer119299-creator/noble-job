import{SettingsForm}from'@/components/admin/SettingsForm'
export default function AdminSettingsPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Admin Settings</h1>
      <SettingsForm/>
    </div>
  )
}
