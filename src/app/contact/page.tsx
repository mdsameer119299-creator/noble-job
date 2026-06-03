'use client'
import{useState}from'react'
import{ContactPersonCard}from'@/components/contact/ContactPersonCard'
import{ContactForm}from'@/components/contact/ContactForm'
import{ContactSuccessBanner}from'@/components/contact/ContactSuccessBanner'
import{ContactInfoPanel}from'@/components/contact/ContactInfoPanel'
import{FaqAccordion}from'@/components/contact/FaqAccordion'
import{StarRating}from'@/components/contact/StarRating'
import{ScrollToTop}from'@/components/shared/ScrollToTop'

export default function ContactPage(){
  const[sent,setSent]=useState(false)
  return(
    <div style={{background:'#f8faff',minHeight:'100vh'}}>
      <div style={{background:'linear-gradient(135deg,#0d1f4e,#1847d4)',padding:'36px 0 28px'}}>
        <div className="wrap">
          <h1 style={{fontFamily:'Playfair Display,serif',fontSize:'clamp(28px,3.5vw,42px)',fontWeight:900,color:'#fff',marginBottom:8}}>Contact Noble Job</h1>
          <p style={{color:'#94a3b8',fontSize:16}}>We&apos;re here to help. Reach us by email, phone or the form below.</p>
        </div>
      </div>
      <div className="wrap" style={{paddingTop:28,paddingBottom:48}}>
        <ContactPersonCard/>
        <div className="contact-layout-2col">
          <div style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'28px',boxShadow:'0 4px 20px rgba(24,71,212,.06)'}}>
            <h2 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',marginBottom:20}}>Send Us a Message</h2>
            {sent?<ContactSuccessBanner onReset={()=>setSent(false)}/>:<ContactForm onSuccess={()=>setSent(true)}/>}
          </div>
          <ContactInfoPanel/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:28,alignItems:'flex-start'}}>
          <FaqAccordion/>
          <div style={{width:260,background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'24px'}}>
            <h4 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',marginBottom:16}}>Rate Our Service</h4>
            <StarRating/>
          </div>
        </div>
      </div>
      <ScrollToTop/>
    </div>
  )
}
