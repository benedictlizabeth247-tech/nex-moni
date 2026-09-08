"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Landmark, Loader2, QrCode, Wallet, Users, ShieldCheck, Clock3, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { BottomNav } from '@/components/layout/BottomNav'
import { NexLogo } from '@/components/ui/NexLogo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AmountEntry } from '@/components/funding/AmountEntry'
import { useToast } from '@/hooks/use-toast'
import { useUser } from '@/supabase'
import { supabase } from '@/lib/supabase'
import { getDepositSession, submitDepositRequest, type DepositSession } from '@/services/deposit'

type Method = 'crypto' | 'fiat' | 'p2p'

type DepositNetwork = { id: string; label: string; memoRequired?: boolean; confirmations: string; feeLabel: string }
const DEPOSIT_NETWORKS: Record<string, DepositNetwork[]> = {
  BTC: [{ id: 'BITCOIN', label: 'Bitcoin', confirmations: '2 confirmations', feeLabel: 'Bitcoin network fee' }],
  XRP: [{ id: 'XRPL', label: 'XRP Ledger', memoRequired: true, confirmations: '1 ledger confirmation', feeLabel: 'XRP Ledger fee' }],
  SOL: [{ id: 'SOLANA', label: 'Solana', confirmations: '32 confirmations', feeLabel: 'Solana network fee' }],
  ETH: [{ id: 'ETHEREUM', label: 'Ethereum', confirmations: '12 confirmations', feeLabel: 'Ethereum network fee' }, { id: 'ARBITRUM', label: 'Arbitrum One', confirmations: '20 confirmations', feeLabel: 'Arbitrum network fee' }, { id: 'BASE', label: 'Base', confirmations: '20 confirmations', feeLabel: 'Base network fee' }],
  USDT: [{ id: 'TRON', label: 'Tron (TRC20)', confirmations: '20 confirmations', feeLabel: 'Tron network fee' }, { id: 'ETHEREUM', label: 'Ethereum (ERC20)', confirmations: '12 confirmations', feeLabel: 'Ethereum network fee' }, { id: 'BSC', label: 'BNB Smart Chain (BEP20)', confirmations: '15 confirmations', feeLabel: 'BNB Smart Chain fee' }, { id: 'ARBITRUM', label: 'Arbitrum One', confirmations: '20 confirmations', feeLabel: 'Arbitrum network fee' }, { id: 'SOLANA', label: 'Solana', confirmations: '32 confirmations', feeLabel: 'Solana network fee' }],
  USDC: [{ id: 'ETHEREUM', label: 'Ethereum (ERC20)', confirmations: '12 confirmations', feeLabel: 'Ethereum network fee' }, { id: 'ARBITRUM', label: 'Arbitrum One', confirmations: '20 confirmations', feeLabel: 'Arbitrum network fee' }, { id: 'BASE', label: 'Base', confirmations: '20 confirmations', feeLabel: 'Base network fee' }, { id: 'SOLANA', label: 'Solana', confirmations: '32 confirmations', feeLabel: 'Solana network fee' }],
}

export default function FundAccountPage() {
  const router = useRouter(); const { user } = useUser(); const { toast } = useToast()
  const [method, setMethod] = useState<Method>('crypto'); const [session, setSession] = useState<DepositSession|null>(null)
  const [banks, setBanks] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState<'choose'|'details'|'pending'>('choose')
  const [amount, setAmount] = useState(''); const [senderBank, setSenderBank] = useState(''); const [reference, setReference] = useState(''); const [asset, setAsset] = useState('USDT'); const [network, setNetwork] = useState('TRON'); const [address, setAddress] = useState(''); const [cryptoAcknowledged, setCryptoAcknowledged] = useState(false)
  const networkOptions = DEPOSIT_NETWORKS[asset] ?? []
  const selectedNetwork = networkOptions.find((item) => item.id === network) ?? networkOptions[0]

  useEffect(() => { Promise.all([
    getDepositSession().then(setSession).catch(()=>setSession(null)),
    fetch('/api/banks').then(r=>r.json()).then(setBanks).catch(()=>setBanks([])),
    fetch('/api/custody/deposit-address', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ asset, network }),
    }).then(async response => {
      if (!response.ok) throw new Error('Custody address unavailable')
      const payload = await response.json()
      if (typeof payload?.address !== 'string' || !payload.address) throw new Error('No address returned')
      setAddress(payload.address)
    }).catch(() => {
      supabase.from('app_config').select('value').eq('id','deposit_wallets').maybeSingle().then(({data})=>{
        const v:any=data?.value; const candidate=v?.[asset]?.[network] || v?.[asset] || ''
        setAddress(typeof candidate === 'string' ? candidate : '')
      })
    })
  ]).finally(()=>setLoading(false)) }, [asset, network])

  useEffect(() => {
    const next = DEPOSIT_NETWORKS[asset]?.[0]?.id
    if (next && !DEPOSIT_NETWORKS[asset].some((item) => item.id === network)) setNetwork(next)
  }, [asset, network])

  const copy = (v:string) => { navigator.clipboard?.writeText(v); toast({title:'Copied'}) }
  const fiatAmount = useMemo(()=>Number(amount||0),[amount])
  const submitFiat = async () => {
    if (!user || !session || fiatAmount <= 0 || !senderBank) { toast({variant:'destructive',title:'Complete the deposit details',description:'Enter the amount and sending bank.'}); return }
    setSubmitting(true)
    try {
      const result=await submitDepositRequest({amount:fiatAmount,senderBank,reference})
      if(!result.success) throw new Error('Deposit request could not be recorded')
      setStage('pending')
    } catch(e:any){toast({variant:'destructive',title:'Deposit failed',description:e?.message||'Please try again.'})} finally{setSubmitting(false)}
  }

  const methods = [
    { id: 'p2p' as const, label: 'P2P', detail: 'Buy from verified merchants', icon: Users },
    { id: 'crypto' as const, label: 'Crypto', detail: 'Receive supported coins', icon: Wallet },
    { id: 'fiat' as const, label: 'Fiat', detail: 'Bank transfer / NGN', icon: Landmark },
  ]

  return <main className="min-h-screen bg-[#F3EEEC] pb-32 text-[#342A28]">
    <header className="sticky top-0 z-30 border-b border-[#E1D5D1] bg-[#F3EEEC]/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto max-w-[520px]">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1D5D1] bg-[#FFFDFB]"><ArrowLeft size={18}/></button>
          <NexLogo/>
          <div className="w-10" />
        </div>
        <div className="mt-4">
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#8E7772]">Funding Account</p>
          <h1 className="mt-1 text-[24px] font-black tracking-[-.025em]">Fund your account</h1>
          <p className="mt-1 max-w-[390px] text-[10px] leading-5 text-[#8E7772]">Choose how you want money or crypto to arrive in your nexMonie Funding balance.</p>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-[520px] space-y-4 px-4 py-5">
      {stage === 'choose' && <>
        <Card className="rounded-[28px] border-[#E1D5D1] bg-[#FFFDFB] p-3 shadow-none">
          <div className="grid grid-cols-3 gap-2">
            {methods.map(({ id, label, detail, icon: Icon }) => {
              const active = method === id
              return <button key={id} onClick={() => { setMethod(id); setAmount('') }} className={`min-h-[104px] rounded-[20px] border p-3 text-left transition-colors ${active ? 'border-[#D86F68] bg-[#F9E8E5]' : 'border-[#E1E8E5] bg-[#FFFDFB]'}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-[#D86F68] text-white' : 'bg-[#F1E9E6] text-[#6F5C57]'}`}><Icon size={18}/></div>
                <b className="mt-3 block text-[11px]">{label}</b>
                <span className="mt-1 block text-[8px] leading-4 text-[#8E7772]">{detail}</span>
              </button>
            })}
          </div>
        </Card>

        {method === 'crypto' && <Card className="rounded-[28px] border-[#E1D5D1] bg-[#FFFDFB] p-5 shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#8E7772]">Crypto deposit</p><h2 className="mt-1 text-[19px] font-black">Receive crypto</h2><p className="mt-1 text-[9px] leading-4 text-[#8E7772]">Select the asset and network before sending funds to this deposit address.</p></div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F9E8E5] text-[#D86F68]"><QrCode size={20}/></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div><p className="mb-1 text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Asset</p><Select value={asset} onValueChange={setAsset}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{['USDT','BTC','ETH','USDC','SOL','XRP'].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div><p className="mb-1 text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Network</p><Select value={selectedNetwork?.id ?? ''} onValueChange={setNetwork}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select network"/></SelectTrigger><SelectContent>{networkOptions.map((option)=><SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {address ? <div className="mt-4 rounded-[22px] bg-[#F8F2F0] p-4">
            <div className="flex items-center justify-between"><div><p className="text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Deposit address</p><p className="mt-1 text-[8px] text-[#8E7772]">{asset} · {selectedNetwork?.label ?? 'Unavailable'}</p></div><button onClick={() => copy(address)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFFDFB]" aria-label="Copy deposit address"><Copy size={15}/></button></div>
            <p className="mt-3 break-all text-[12px] font-black leading-5 text-[#342A28]">{address}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
              <div className="rounded-xl border border-[#E1D5D1] bg-[#FFFDFB] p-3"><span className="block text-[#8E7772]">Network fee</span><b className="mt-1 block">{selectedNetwork?.feeLabel ?? 'Shown before send'}</b></div>
              <div className="rounded-xl border border-[#E1D5D1] bg-[#FFFDFB] p-3"><span className="block text-[#8E7772]">Confirmations</span><b className="mt-1 block">{selectedNetwork?.confirmations ?? 'Required on-chain'}</b></div>
            </div>
            <div className="mt-4 flex justify-center rounded-[20px] bg-white p-4">
              <img src={`https://quickchart.io/qr?text=${encodeURIComponent(address)}&size=180`} alt={`${asset} ${network} deposit QR code`} className="h-40 w-40 rounded-xl" loading="lazy" />
            </div>
            <div className="mt-3 flex items-start gap-2 text-[8px] leading-4 text-[#8E7772]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#D86F68]"/><span>Only send {asset} using {selectedNetwork?.label ?? 'the selected network'}. Sending an unsupported asset or network can result in permanent loss.</span></div>
            {selectedNetwork?.memoRequired && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[9px] leading-4 text-amber-900"><b>Destination tag / memo required</b><p className="mt-1">Include the memo supplied with this deposit. Without it, the transfer may not be recoverable.</p></div>}
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-[9px] leading-4 text-[#6F5C57]"><input type="checkbox" checked={cryptoAcknowledged} onChange={(event) => setCryptoAcknowledged(event.target.checked)} className="mt-0.5 accent-[#D86F68]"/>I confirm the asset and network match before sending.</label>
            <button type="button" disabled={!cryptoAcknowledged} onClick={() => toast({ title: 'Deposit marked for review', description: 'Send only after confirming the network. Your transfer will remain pending until on-chain confirmation.' })} className="mt-3 h-11 w-full rounded-xl bg-[#342A28] text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">I&apos;ve sent the deposit</button>
          </div> : <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-black text-amber-800">Deposit address not configured</p><p className="mt-1 text-[9px] leading-5 text-amber-700">No wallet address is invented. Configure this asset/network in the operational deposit-wallet settings before accepting on-chain deposits.</p></div>}
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#FAF7F5] p-3"><Clock3 size={16} className="mt-0.5 shrink-0 text-[#D86F68]"/><p className="text-[9px] leading-5 text-[#8E7772]">A blockchain transfer is not treated as a completed deposit until the configured confirmation process records it.</p></div>
        </Card>}

        {method === 'fiat' && <Card className="rounded-[28px] border-[#E1D5D1] bg-[#FFFDFB] p-5 shadow-none">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#8E7772]">Fiat deposit</p>
          <h2 className="mt-1 text-[19px] font-black">Deposit NGN by bank transfer</h2>
          <div className="mt-4 rounded-[22px] bg-[#F8F2F0] p-4">
            <div className="grid grid-cols-1 gap-3">
              <div><p className="text-[8px] uppercase tracking-widest text-[#8E7772]">Bank</p><b className="mt-1 block text-[13px]">{loading ? 'Loading…' : session?.bankName || 'Not configured'}</b></div>
              <div><p className="text-[8px] uppercase tracking-widest text-[#8E7772]">Account number</p><div className="mt-1 flex items-center justify-between gap-3"><b className="text-[20px] tracking-wide">{session?.accountNumber || 'Not configured'}</b>{session?.accountNumber && <button onClick={() => copy(session.accountNumber)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFFDFB]" aria-label="Copy account number"><Copy size={16}/></button>}</div></div>
              <div><p className="text-[8px] uppercase tracking-widest text-[#8E7772]">Account name</p><b className="mt-1 block text-[12px]">{session?.accountName || 'Not configured'}</b></div>
            </div>
          </div>
          <div className="mt-4"><AmountEntry value={amount} onChange={setAmount} currency="NGN" label="How much are you depositing?"/></div>
          <div className="mt-3 space-y-3">
            <Select value={senderBank} onValueChange={setSenderBank}><SelectTrigger className="h-12 rounded-xl bg-[#FFFDFB]"><SelectValue placeholder="Select your sending bank"/></SelectTrigger><SelectContent>{banks.map(b=><SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>
            <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Transfer reference (optional)" className="h-12 w-full rounded-xl border border-[#E1D5D1] bg-[#FFFDFB] px-3 text-[11px] outline-none"/>
          </div>
          <button disabled={submitting || !session} onClick={submitFiat} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E1D5D1] bg-[#FFFDFB] text-[10px] font-black text-[#342A28] disabled:opacity-50">I already made a bank transfer <ArrowRight size={14}/></button>
        </Card>}

        {method === 'p2p' && <Card className="rounded-[28px] border-[#E1D5D1] bg-[#FFFDFB] p-5 shadow-none">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F9E8E5] text-[#D86F68]"><Users size={21}/></div>
          <p className="mt-4 text-[9px] font-black uppercase tracking-[.18em] text-[#8E7772]">P2P funding</p>
          <h2 className="mt-1 text-[19px] font-black">Buy from a merchant</h2>
          <p className="mt-2 text-[10px] leading-5 text-[#8E7772]">Choose an available P2P merchant, payment method and asset. The order remains pending until the P2P workflow records the result.</p>
          <button onClick={() => router.push('/finance/p2p')} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#D86F68] text-[11px] font-black text-white">Open P2P marketplace <ChevronRight size={16}/></button>
        </Card>}
      </>}

      {stage === 'pending' && <Card className="rounded-[30px] border-[#E1D5D1] bg-[#FFFDFB] p-7 text-center shadow-none"><CheckCircle2 size={52} className="mx-auto text-[#B86B64]"/><h2 className="mt-4 text-[21px] font-black">Deposit submitted</h2><p className="mt-2 text-[10px] leading-5 text-[#8E7772]">Your deposit proof is recorded for operational review. The balance is not credited until the configured confirmation process approves it.</p><button onClick={() => router.push('/transactions')} className="mt-5 w-full rounded-2xl bg-[#342A28] py-3 text-[10px] font-black text-white">View activity</button></Card>}
    </div>
    <BottomNav/>
  </main>
}
