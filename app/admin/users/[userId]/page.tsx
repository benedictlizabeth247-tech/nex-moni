'use client'

import Link from 'next/link'
import { use, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw, ShieldAlert, WalletCards } from 'lucide-react'
import { CreditForm } from '@/components/admin/credit-form'
import { WalletControls } from '@/components/admin/wallet-controls'

type Row = Record<string, unknown>
type AdminData = Record<string, unknown>

export default function AdminUserDetail({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const [data, setData] = useState<AdminData>({})
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const response = await fetch('/api/admin/requests', { cache: 'no-store' })
      const json: unknown = await response.json()
      if (!response.ok) throw new Error(typeof json === 'object' && json !== null && 'error' in json ? String(json.error) : 'Unable to load user')
      setData(typeof json === 'object' && json !== null ? json as AdminData : {})
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load user')
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 10000)
    return () => window.clearInterval(timer)
  }, [])

  const users = Array.isArray(data.users) ? data.users.filter((row): row is Row => typeof row === 'object' && row !== null) : []
  const user = useMemo(() => users.find((row) => String(row.id) === userId), [users, userId])
  const related: Array<{ source: string; row: Row }> = []
  for (const [source, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue
    for (const candidate of value) {
      if (typeof candidate === 'object' && candidate !== null) {
        const row = candidate as Row
        if (String(row.user_id || '') === userId) related.push({ source, row })
      }
    }
  }

  return <main className="min-h-screen bg-[#101A18] p-4 text-[#EAF4F0] md:p-8"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between"><Link href="/admin/users" className="inline-flex items-center gap-2 text-xs font-bold text-[#55D6A7]"><ArrowLeft size={15} /> Users</Link><button onClick={() => void load()} aria-label="Refresh user" className="rounded-xl border border-[#29413A] p-2 text-[#55D6A7]"><RefreshCw size={16} /></button></div>
    {error && <div className="mt-6 flex gap-2 rounded-2xl border border-[#713B3B] bg-[#321E20] p-4 text-xs text-[#FFB4B4]"><ShieldAlert size={17} />{error}</div>}
    <section className="mt-8 rounded-3xl border border-[#29413A] bg-[#15231F] p-5"><p className="text-[10px] uppercase tracking-[.2em] text-[#55D6A7]">Supabase account</p><h1 className="mt-2 text-2xl font-black">{String(user?.email || userId)}</h1><p className="mt-2 text-xs text-[#9BB8AF]">Registered {user?.created_at ? new Date(String(user.created_at)).toLocaleString() : '—'} · Confirmed {user?.email_confirmed_at ? 'yes' : 'no'}</p></section>
    <section className="mt-4 rounded-3xl border border-[#29413A] bg-[#15231F] p-5"><div className="flex items-center gap-2"><WalletCards size={18} className="text-[#55D6A7]" /><h2 className="font-black">Related account records</h2></div>{related.length ? <div className="mt-4 divide-y divide-[#29413A]">{related.map(({ source, row }, index) => <div key={`${source}-${index}`} className="flex justify-between gap-3 py-3 text-xs"><span className="font-bold">{source}</span><span className="text-right text-[#9BB8AF]">{String(row.status || row.currency || row.amount || row.kind || 'record')} · {row.created_at ? new Date(String(row.created_at)).toLocaleString() : 'live'}</span></div>)}</div> : <p className="mt-4 text-sm text-[#9BB8AF]">No operational records are currently linked to this account.</p>}</section>
    <section className="mt-4 rounded-3xl border border-[#29413A] bg-[#15231F] p-5"><h2 className="font-black">Manage credits</h2><p className="mt-1 text-xs text-[#9BB8AF]">Every adjustment is recorded in the Supabase ledger and applied atomically.</p><CreditForm userId={userId} /><WalletControls userId={userId} currency="USDT" /></section>
  </div></main>
}
