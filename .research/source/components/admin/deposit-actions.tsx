'use client'

import { useState } from 'react'

export function DepositActions({ id, onDone }: { id: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function act(action: 'approve' | 'reject') {
    if (action === 'reject' && !window.confirm('Reject this deposit?')) return
    const note = window.prompt(action === 'approve' ? 'Verification note (optional)' : 'Reason for rejection')
    if (action === 'reject' && !note?.trim()) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ depositId: id, action, note: note?.trim() || undefined }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Deposit action failed.')
      setMessage(action === 'approve' ? 'Credited' : 'Rejected')
      onDone?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deposit action failed.')
    } finally { setBusy(false) }
  }

  return <div className="flex items-center gap-2">
    <button disabled={busy} onClick={() => void act('approve')} className="rounded-lg bg-[#55D6A7] px-2 py-1 text-[10px] font-black text-[#102019] disabled:opacity-50">Approve & credit</button>
    <button disabled={busy} onClick={() => void act('reject')} className="rounded-lg border border-[#713B3B] px-2 py-1 text-[10px] font-bold text-[#FFB4B4] disabled:opacity-50">Reject</button>
    {message && <span role="status" className="text-[10px] text-[#8DE0BD]">{message}</span>}
  </div>
}
