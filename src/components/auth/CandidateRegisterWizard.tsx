'use client'
import{useEffect,useState}from'react'
import{track,AcqEvent}from'@/lib/analytics/events'
import{validateCandidateRegisterForm,CANDIDATE_REGISTER_FIELD_ORDER,type CandidateRegisterErrors,type CandidateRegisterField}from'@/lib/validations/candidateRegisterForm'
import{StepIndicator}from'./StepIndicator'
import{CandidateRegisterStep1}from'./CandidateRegisterStep1'
import{OtpVerification}from'./OtpVerification'
import{SuccessPane}from'./SuccessPane'
import{Button}from'@/components/ui/Button'
import{useToast}from'@/hooks/useToast'

/**
 * Candidate sign-up: name + email + password (phone optional) -> email OTP -> dashboard.
 * Category / experience / skills are collected AFTER the account exists (ProfileCompletionCard on the dashboard).
 */
export function CandidateRegisterWizard(){
  const[step,setStep]=useState(0) // 0 details · 1 email OTP · 2 done
  const[form,setForm]=useState<any>({})
  const[loading,setLoading]=useState(false)
  const[errors,setErrors]=useState<CandidateRegisterErrors>({})
  const toast=useToast()
  useEffect(()=>{track(AcqEvent.REGISTER_VIEWED,{role:'candidate',src:new URLSearchParams(window.location.search).get('src')||''})},[])
  const onChange=(k:string,v:any)=>{
    setForm((f:any)=>({...f,[k]:v}))
    setErrors(e=>e[k as CandidateRegisterField]?{...e,[k]:undefined}:e) // clear a field's message as soon as the person edits it
  }
  // Validate one field when leaving it (only if something was typed, so tabbing past an empty box is not nagging).
  const onBlurField=(k:CandidateRegisterField)=>{
    if(!form[k])return
    const r=validateCandidateRegisterForm(form)
    setErrors(e=>({...e,[k]:r.ok?undefined:r.errors[k]}))
  }

  const handleCreate=async()=>{
    // Same schema as the server; one clear message per field instead of a generic toast.
    const v=validateCandidateRegisterForm(form)
    if(!v.ok){
      setErrors(v.errors)
      const first=CANDIDATE_REGISTER_FIELD_ORDER.find(k=>v.errors[k])
      if(first)document.getElementById(`cr-${first}`)?.focus()
      return
    }
    setErrors({})
    const parsed={data:v.data}
    setLoading(true)
    try{
      const res=await fetch('/api/auth/register/candidate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)})
      const data=await res.json().catch(()=>({}))
      if(res.ok){track(AcqEvent.REGISTER_SUBMITTED,{role:'candidate'});setStep(1)}
      else toast.error(data.error||'Registration failed')
    }catch{toast.error('Network error. Please try again.')}
    setLoading(false)
  }

  return(
    <div>
      <StepIndicator total={3} current={step}/>
      {step===0&&(
        <>
          <CandidateRegisterStep1 form={form} onChange={onChange} errors={errors} onBlurField={onBlurField}/>
          <Button variant="blue" onClick={handleCreate} loading={loading} className="w-full mt-6">Create free account</Button>
          <p style={{fontSize:12,color:'#6b7280',textAlign:'center',marginTop:10}}>Takes under a minute. You can add your skills and experience after signing up.</p>
        </>
      )}
      {step===1&&<OtpVerification email={form.email} onVerified={()=>{track(AcqEvent.REGISTER_VERIFIED,{role:'candidate'});setStep(2)}}/>}
      {step===2&&<SuccessPane role="candidate" name={form.firstName}/>}
    </div>
  )
}
