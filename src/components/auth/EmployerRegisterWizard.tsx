'use client'
import{useState}from'react'
import{StepIndicator}from'./StepIndicator'
import{EmployerRegisterStep1}from'./EmployerRegisterStep1'
import{EmployerRegisterStep2}from'./EmployerRegisterStep2'
import{OtpVerification}from'./OtpVerification'
import{SuccessPane}from'./SuccessPane'
import{Button}from'@/components/ui/Button'
import{useToast}from'@/hooks/useToast'

export function EmployerRegisterWizard(){
  const[step,setStep]=useState(0)
  const[form,setForm]=useState<any>({})
  const[loading,setLoading]=useState(false)
  const toast=useToast()
  const onChange=(k:string,v:any)=>setForm((f:any)=>({...f,[k]:v}))

  const handleStep1=()=>{
    if(!form.firstName||!form.lastName||!form.email||!form.password){toast.error('Fill all required fields');return}
    if(!form.terms){toast.error('Accept the terms to continue');return}
    setStep(1)
  }
  const handleStep2=async()=>{
    if(!form.companyName||!form.city||!form.industry||!form.companySize||!form.designation){
      toast.error('Fill all company details');return
    }
    setLoading(true)
    const res=await fetch('/api/auth/register/employer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const data=await res.json()
    if(res.ok)setStep(2)
    else toast.error(data.error||'Registration failed')
    setLoading(false)
  }

  return(
    <div>
      <StepIndicator total={4} current={step}/>
      {step===0&&(
        <>
          <EmployerRegisterStep1 form={form} onChange={onChange} errors={{}}/>
          <Button variant="blue" onClick={handleStep1} className="w-full mt-6">Continue →</Button>
        </>
      )}
      {step===1&&(
        <>
          <EmployerRegisterStep2 form={form} onChange={onChange} errors={{}}/>
          <div style={{display:'flex',gap:10,marginTop:20}}>
            <Button variant="ghost" onClick={()=>setStep(0)} className="flex-1">← Back</Button>
            <Button variant="blue" onClick={handleStep2} loading={loading} className="flex-1">Create Account</Button>
          </div>
        </>
      )}
      {step===2&&<OtpVerification email={form.email} onVerified={()=>setStep(3)}/>}
      {step===3&&<SuccessPane role="employer" name={form.firstName}/>}
    </div>
  )
}
