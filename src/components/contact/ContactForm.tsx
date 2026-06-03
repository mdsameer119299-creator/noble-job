'use client'
import{useState}from'react'
import{Input}from'@/components/ui/Input'
import{Textarea}from'@/components/ui/Textarea'
import{Button}from'@/components/ui/Button'
import{InquiryTypeSelector}from'./InquiryTypeSelector'
import{useToast}from'@/hooks/useToast'
interface ContactFormProps{onSuccess:()=>void}
export function ContactForm({onSuccess}:ContactFormProps){
  const[form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',subject:'',userType:'candidate',message:'',terms:false,inquiryType:'general'})
  const[loading,setLoading]=useState(false)
  const toast=useToast()
  const set=(k:string,v:any)=>setForm(f=>({...f,[k]:v}))
  const handleSubmit=async()=>{
    if(!form.firstName||!form.email||!form.subject||!form.message){toast.error('Please fill all required fields');return}
    if(form.message.length<20){toast.error('Message must be at least 20 characters');return}
    if(!form.terms){toast.error('Please accept the terms');return}
    setLoading(true)
    const res=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    if(res.ok){toast.success('Message sent!');onSuccess()}
    else toast.error('Failed to send message')
    setLoading(false)
  }
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <InquiryTypeSelector value={form.inquiryType} onChange={v=>set('inquiryType',v)}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Input label="First Name *" value={form.firstName} onChange={e=>set('firstName',e.target.value)} placeholder="First name"/>
        <Input label="Last Name *" value={form.lastName} onChange={e=>set('lastName',e.target.value)} placeholder="Last name"/>
      </div>
      <Input label="Email Address *" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@example.com"/>
      <Input label="Phone (Optional)" type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 98765 43210"/>
      <Input label="Subject *" value={form.subject} onChange={e=>set('subject',e.target.value)} placeholder="How can we help?"/>
      <div>
        <label style={{display:'block',fontSize:13,fontWeight:700,color:'#0d1f4e',marginBottom:8}}>I am a *</label>
        <div style={{display:'flex',gap:10}}>
          {[{v:'candidate',l:'Job Seeker'},{v:'employer',l:'Employer'},{v:'other',l:'Other'}].map(o=>(
            <label key={o.v} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer'}}>
              <input type="radio" name="userType" checked={form.userType===o.v} onChange={()=>set('userType',o.v)} style={{accentColor:'#1847d4'}}/>
              <span style={{fontSize:13,fontWeight:600,color:'#374151'}}>{o.l}</span>
            </label>
          ))}
        </div>
      </div>
      <Textarea label="Your Message *" value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Tell us how we can help you (min 20 characters)"/>
      <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
        <input type="checkbox" checked={form.terms} onChange={e=>set('terms',e.target.checked)} style={{marginTop:2,accentColor:'#1847d4'}}/>
        <span style={{fontSize:12.5,color:'#6b7280'}}>I agree to Noble Job's Terms of Service and Privacy Policy. Noble Job never shares my information with third parties.</span>
      </label>
      <Button variant="blue" onClick={handleSubmit} loading={loading} className="w-full mt-2">Send Message 📨</Button>
    </div>
  )
}
