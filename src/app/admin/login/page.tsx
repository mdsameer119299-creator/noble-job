'use client'
import{useState}from'react'
import{useRouter}from'next/navigation'
import{Input}from'@/components/ui/Input'
import{Button}from'@/components/ui/Button'
import{PasswordInput}from'@/components/auth/PasswordInput'
import{useToast}from'@/hooks/useToast'
export default function AdminLoginPage(){
  const[form,setForm]=useState({email:'',password:''})
  const[loading,setLoading]=useState(false)
  const toast=useToast();const router=useRouter()
  const handleLogin=async()=>{
    setLoading(true)
    const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const data=await res.json()
    if(res.ok){toast.success('Welcome, Admin!');router.push('/admin/dashboard')}
    else toast.error(data.error||'Login failed')
    setLoading(false)
  }
  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#060e28,#0d1f4e)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:400,background:'#fff',borderRadius:20,border:'1.5px solid #e2e8f0',padding:'36px 32px',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:12}}>🛡️</div>
          <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:4}}>Admin Login</h1>
          <p style={{color:'#6b7280',fontSize:13}}>Noble Job Administration Panel</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <Input label="Admin Email" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="admin@noblejob.in"/>
          <PasswordInput label="Password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Admin password"/>
          <Button variant="blue" onClick={handleLogin} loading={loading} className="w-full mt-2">Login to Admin Panel</Button>
        </div>
        <p style={{textAlign:'center',color:'#9ca3af',fontSize:12,marginTop:16}}>Noble Job · NCC Foundation Admin Portal</p>
      </div>
    </div>
  )
}
