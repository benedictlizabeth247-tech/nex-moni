'use client'
import { useState } from 'react'

type Resource='airtime'|'data'|'bills'|'scan'|'merchant'
export function AdminServiceActions({resource,id,status,onDone}:{resource:Resource,id:string,status:string,onDone?:()=>void}){
 const [busy,setBusy]=useState(false)
 const run=async(action:'process'|'fulfill'|'reject'|'approve')=>{
  let note:string|undefined
  if(action==='reject') { note=window.prompt('Reason for rejection')||undefined; if(!note?.trim()) return }
  setBusy(true)
  try{
   const r=await fetch('/api/admin/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resource,requestId:id,action,note})})
   const j=await r.json().catch(()=>null); if(!r.ok) throw new Error(j?.error||'Operation failed.')
   onDone?.()
  }catch(e){window.alert(e instanceof Error?e.message:'Operation failed.')}finally{setBusy(false)}
 }
 if(busy) return <span className="text-[10px] text-[#8CB4A8]">Updating…</span>
 if(resource==='merchant'){
  if(status==='pending_admin_approval'||status==='pending'||status==='rejected') return <div className="flex gap-1"><button onClick={()=>void run('approve')} className="rounded-lg bg-[#55D6A7] px-2 py-1 text-[10px] font-bold text-[#10231F]">Approve</button><button onClick={()=>void run('reject')} className="rounded-lg border border-[#713B3B] px-2 py-1 text-[10px] font-bold text-[#FFB4B4]">Reject</button></div>
  return null
 }
 if(status==='pending') return <div className="flex gap-1"><button onClick={()=>void run('process')} className="rounded-lg bg-[#55D6A7] px-2 py-1 text-[10px] font-bold text-[#10231F]">Process</button><button onClick={()=>void run('reject')} className="rounded-lg border border-[#713B3B] px-2 py-1 text-[10px] font-bold text-[#FFB4B4]">Reject</button></div>
 if(status==='processing') return <div className="flex gap-1"><button onClick={()=>void run('fulfill')} className="rounded-lg bg-[#55D6A7] px-2 py-1 text-[10px] font-bold text-[#10231F]">Fulfill</button><button onClick={()=>void run('reject')} className="rounded-lg border border-[#713B3B] px-2 py-1 text-[10px] font-bold text-[#FFB4B4]">Reject</button></div>
 return null
}
