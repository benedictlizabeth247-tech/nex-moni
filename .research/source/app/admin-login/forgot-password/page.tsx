"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, MailCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NexLogo } from "@/components/ui/NexLogo"

export default function ForgotAdminPassword(){
  const [email,setEmail]=useState("")
  const [busy,setBusy]=useState(false)
  const [sent,setSent]=useState(false)
  const [error,setError]=useState("")
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setBusy(true); setError("")
    const normalized=email.trim().toLowerCase()
    try{
      const check=await fetch('/api/admin/recovery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:normalized})})
      const result=await check.json().catch(()=>({authorized:false}))
      if(!result.authorized){
        // Keep the response generic so the screen is not an admin-account enumeration oracle.
        setSent(true); return
      }
      const supabase=createClient()
      const redirectTo=`${window.location.origin}/auth/callback?next=/auth/update-password`
      const {error}=await supabase.auth.resetPasswordForEmail(normalized,{redirectTo})
      if(error) throw error
      setSent(true)
    }catch(cause){setError(cause instanceof Error?cause.message:"Unable to send the reset email.")}finally{setBusy(false)}
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#0D0F11] px-5 py-8 text-white"><div className="w-full max-w-sm"><div className="mb-8 flex flex-col items-center gap-4"><NexLogo className="[&_*]:!text-white"/><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#183A36] text-[#55D6A7]"><MailCheck size={25}/></div><div className="text-center"><h1 className="text-xl font-black">Reset admin password</h1><p className="mt-1 text-xs text-[#8D959D]">We will send a secure Supabase recovery link.</p></div></div>{sent?<div className="rounded-3xl border border-[#29413A] bg-[#171A1E] p-6 text-center"><h2 className="font-black">Check your email</h2><p className="mt-2 text-xs leading-5 text-[#9BA3AA]">If that address belongs to an active NexMonie administrator, Supabase has sent the password-reset link.</p><Link href="/admin-login" className="mt-5 block rounded-2xl bg-[#55D6A7] px-4 py-3 text-sm font-black text-[#102019]">Back to admin sign-in</Link></div>:<form onSubmit={submit} className="space-y-4 rounded-3xl border border-[#30343A] bg-[#171A1E] p-5"><div className="space-y-2"><Label htmlFor="email" className="text-xs font-bold uppercase tracking-wide text-[#8D959D]">Admin email</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="h-12 rounded-2xl border-[#30343A] bg-[#0D0F11] text-white"/></div>{error&&<p className="rounded-xl bg-[#321E20] px-3 py-2.5 text-xs font-semibold text-[#FFB4B4]">{error}</p>}<Button disabled={busy} className="h-12 w-full rounded-2xl bg-[#55D6A7] font-black text-[#102019]">{busy?<><Loader2 size={16} className="mr-2 animate-spin"/>Sending…</>:"Send reset link"}</Button><Link href="/admin-login" className="block text-center text-xs font-bold text-[#55D6A7]">Back to admin sign-in</Link></form>}</div></main>
}
