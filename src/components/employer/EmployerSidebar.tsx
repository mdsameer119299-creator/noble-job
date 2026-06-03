'use client'
import Link from'next/link'
import{usePathname}from'next/navigation'

const NAV=[
  {href:'/employer/dashboard',label:'Dashboard',icon:'📊'},
  {href:'/employer/jobs',label:'Job Postings',icon:'💼'},
  {href:'/employer/candidates',label:'Applications',icon:'📋'},
  {href:'/employer/analytics',label:'Analytics',icon:'📈'},
  {href:'/employer/profile',label:'Company Profile',icon:'🏢'},
  {href:'/employer/billing',label:'Billing & Plans',icon:'💳'},
  {href:'/employer/settings',label:'Settings',icon:'⚙️'},
]

export function EmployerSidebar(){
  const path=usePathname()
  return(
    <aside className="dashboard-sidebar" style={{width:230,flexShrink:0,position:'sticky',top:110}}>
      <div style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 4px 20px rgba(24,71,212,.06)'}}>
        <div style={{background:'linear-gradient(135deg,#0d1f4e,#1847d4)',padding:'20px 18px'}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:18,marginBottom:10}}>E</div>
          <div style={{color:'#fff',fontWeight:800,fontSize:14}}>Employer Portal</div>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:12}}>Noble Job Dashboard</div>
        </div>
        <nav className="dashboard-sidebar__nav" style={{padding:'8px 0'}}>
          {NAV.map(n=>{
            const active=path===n.href||path.startsWith(n.href+'/')
            return(
              <Link key={n.href} href={n.href}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 18px',fontSize:13.5,fontWeight:active?800:600,textDecoration:'none',transition:'all .15s',background:active?'#eff6ff':'transparent',color:active?'#1847d4':'#374151',borderRight:active?'3px solid #1847d4':'3px solid transparent'}}>
                <span style={{fontSize:16}}>{n.icon}</span>{n.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
