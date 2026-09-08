'use client'

import { useState } from 'react'

export function WithdrawalActions({ id, status, onDone }: { id: string; status: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false)
  const run = async (action: 'approve'|'reject'|'hold'|'mark_processing'|'resume'|'complete'|'fail') => {
    let note: string | null = null
    if (action === 'reject' || action === 'hold' || action === 'fail') note = window.prompt(action === 'reject' ? 'Reason for rejection' : action === 'fail' ? 'Reason for failed withdrawal / refund' : 'Reason for hold')
    if ((action === 'reject' || action === 'hold' || action === 'fail') && !note?.trim()) return
    setBusy(true)
    try {
      const response = await fetch('/api/admin/withdrawals', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ withdrawalId:id, action, note }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Operation failed.')
      onDone?.()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Operation failed.')
    } finally { setBusy(false) }
  }
  if (busy) return <span className="text-[10px] text-[#8CB4A8]">Updating…</span>
  if (status === 'pending') return <div className="flex gap-1"><button onClick={()=>void run('approve')} className="rounded-lg bg-[#55D6A7] px-2 py-1 text-[10px] font-bold text-[#10231F]">Approve</button><button onClick={()=>void run('reject')} className="rounded-lg bg-[#713B3B] px-2 py-1 text-[10px] font-bold text-white">Reject</button></div>
  if (status === 'processing') return <div className="flex gap-1"><button onClick={()=>void run('complete')} className="rounded-lg bg-[#55D6A7] px-2 py-1 text-[10px] font-bold text-[#10231F]">Fulfilled</button><button onClick={()=>void run('fail')} className="rounded-lg bg-[#713B3B] px-2 py-1 text-[10px] font-bold text-white">Failed</button><button onClick={()=>void run('hold')} className="rounded-lg bg-[#20362E] px-2 py-1 text-[10px] font-bold text-[#8DE0BD]">Hold</button></div>
  if (status === 'on_hold') return <div className="flex gap-1"><button onClick={()=>void run('resume')} className="rounded-lg bg-[#55D6A7] px-2 py-1 text-[10px] font-bold text-[#10231F]">Resume</button><button onClick={()=>void run('fail')} className="rounded-lg bg-[#713B3B] px-2 py-1 text-[10px] font-bold text-white">Failed</button><button onClick={()=>void run('reject')} className="rounded-lg bg-[#713B3B] px-2 py-1 text-[10px] font-bold text-white">Reject</button></div>
  return null
}
