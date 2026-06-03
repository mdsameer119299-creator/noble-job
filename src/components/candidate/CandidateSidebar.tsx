'use client'
import Link from'next/link'
import{usePathname}from'next/navigation'
const NAV=[
  {href:'/candidate/dashboard',label:'Dashboard',icon:'📊'},
  {href:'/candidate/applications',label:'My Applications',icon:'📋'},
  {href:'/candidate/profile',label:'My Profile',icon:'👤'},
  {href:'/candidate/resume',label:'My Resume',icon:'📄'},
  {href:'/candidate/saved-jobs',label:'Saved Jobs',icon:'🔖'},
  {href:'/candidate/alerts',label:'Job Alerts',icon:'🔔'},
  {href:'/candidate/messages',label:'Messages',icon:'💬'},
  {href:'/candidate/skill-tests',label:'Skill Tests',icon:'🎯'},
  {href:'/candidate/interview-prep',label:'Interview Prep',icon:'🎤'},
  {href:'/candidate/resources',label:'Career Resources',icon:'📚'},
  {href:'/candidate/settings',label:'Account Settings',icon:'⚙️'},
]
export function CandidateSidebar(){
  const path=usePathname()
  return(
    <aside className="dashboard-sidebar" style={{width:230,flexShrink:0,position:'sticky',top:110}}>
      <div style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 4px 20px rgba(24,71,212,.06)'}}>
        <div style={{background:'linear-gradient(135deg,#1847d4,#7c3aed)',padding:'20px 18px'}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:18,marginBottom:10}}>C</div>
          <div style={{color:'#fff',fontWeight:800,fontSize:14}}>Job Seeker Portal</div>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:12}}>Noble Job Dashboard</div>
        </div>
        <nav className="dashboard-sidebar__nav" style={{padding:'8px 0'}}>
          {NAV.map(n=>{
            const active=path===n.href||path.startsWith(n.href+'/')
            return(
              <Link key={n.href} href={n.href}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 18px',fontSize:13.5,fontWeight:active?800:600,textDecoration:'none',transition:'all .15s',background:active?'#f5f3ff':'transparent',color:active?'#7c3aed':'#374151',borderRight:active?'3px solid #7c3aed':'3px solid transparent'}}>
                <span style={{fontSize:16}}>{n.icon}</span>{n.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
