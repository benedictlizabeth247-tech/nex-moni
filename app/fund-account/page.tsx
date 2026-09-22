"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Landmark, QrCode, Wallet, ShieldCheck, Clock3 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { BottomNav } from '@/components/layout/BottomNav'
import { NexLogo } from '@/components/ui/NexLogo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AmountEntry } from '@/components/funding/AmountEntry'
import { useToast } from '@/hooks/use-toast'
import { useUser } from '@/supabase'
import { supabase } from '@/lib/supabase'
import { getDepositSession, submitDepositRequest, type DepositSession } from '@/services/deposit'

type Method = 'crypto' | 'fiat'

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
  const [amount, setAmount] = useState(''); const [usdNgnRate, setUsdNgnRate] = useState<number | null>(null); const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null); const [senderBank, setSenderBank] = useState(''); const [senderAccountName, setSenderAccountName] = useState(''); const [senderAccountNumber, setSenderAccountNumber] = useState(''); const [bankQuery, setBankQuery] = useState(''); const [showBankList, setShowBankList] = useState(false); const [receivingBank, setReceivingBank] = useState('UBA'); const [copiedAccount, setCopiedAccount] = useState(false); const [countdown, setCountdown] = useState(15 * 60); const [reference, setReference] = useState(''); const [asset, setAsset] = useState('USDT'); const [network, setNetwork] = useState('TRON'); const [address, setAddress] = useState(''); const [cryptoAcknowledged, setCryptoAcknowledged] = useState(false)
  const networkOptions = DEPOSIT_NETWORKS[asset] ?? []
  const selectedNetwork = networkOptions.find((item) => item.id === network) ?? networkOptions[0]
  const receivingAccounts = session?.receivingAccounts ?? [{ bankName: 'UBA', accountNumber: '2295345512', accountName: 'Benjamin Arinze Atuchukwu' }, { bankName: 'Access Bank', accountNumber: '1841089139', accountName: 'Benjamin Arinze' }]
  const selectedReceiving = receivingAccounts.find((account) => account.bankName === receivingBank) ?? receivingAccounts[0]
  const matchingBanks = banks.filter((bank) => String(bank.name ?? '').toLowerCase().includes(bankQuery.trim().toLowerCase())).slice(0, 90)
  const countdownLabel = `${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`

  useEffect(() => {
    if (stage !== 'pending') return
    const expiresAt = session?.expiryTime?.getTime() ?? Date.now() + (method === 'crypto' ? 25 : 15) * 60 * 1000
    const updateCountdown = () => setCountdown(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [stage, method, session?.expiryTime])

  useEffect(() => { Promise.all([
    getDepositSession().then(setSession).catch(()=>setSession(null)),
    fetch('/api/banks').then(r=>r.json()).then(setBanks).catch(()=>setBanks([])),
    fetch('/api/valuation', { cache: 'no-store' }).then(r=>r.json()).then(payload => { const rate = Number(payload?.usdNgn?.rate); setUsdNgnRate(Number.isFinite(rate) && rate > 0 ? rate : null); setRateUpdatedAt(payload?.usdNgn?.receivedAt ?? null) }).catch(() => { setUsdNgnRate(null); setRateUpdatedAt(null) }),
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

  const copy = (v:string, account = false) => { navigator.clipboard?.writeText(v); if (account) { setCopiedAccount(true); window.setTimeout(() => setCopiedAccount(false), 1800) }; toast({title:'Copied'}) }
  const fiatAmount = useMemo(()=>Number(amount||0),[amount])
  const canSubmitFiat = Boolean(user && session && fiatAmount > 0 && senderBank && senderAccountName.trim().length >= 2 && senderAccountNumber.length === 10)
  const submitFiat = async () => {
    if (!canSubmitFiat) return
    setSubmitting(true)
    try {
      const result=await submitDepositRequest({amount:fiatAmount,senderBank,senderAccountName,senderAccountNumber,reference,receivingBank})
      if(!result.success) throw new Error('Deposit request could not be recorded')
      setStage('pending')
    } catch(e:any){toast({variant:'destructive',title:'Deposit failed',description:e?.message||'Please try again.'})} finally{setSubmitting(false)}
  }

  const methods = [
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
          <div className="grid grid-cols-1 gap-2">
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
          <div className="mt-5 space-y-3">
            <div><p className="mb-1 text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Asset</p><Select value={asset} onValueChange={setAsset}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{['USDT','BTC','ETH','USDC','SOL','XRP'].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div><p className="mb-1 text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Network</p><Select value={selectedNetwork?.id ?? ''} onValueChange={setNetwork}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select network"/></SelectTrigger><SelectContent>{networkOptions.map((option)=><SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {address ? <div className="mt-4 rounded-[22px] bg-[#F8F2F0] p-4">
            <div className="flex items-center justify-between"><div><p className="text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Deposit address</p><p className="mt-1 text-[8px] text-[#8E7772]">{asset} · {selectedNetwork?.label ?? 'Unavailable'}</p></div><button onClick={() => copy(address)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFFDFB]" aria-label="Copy deposit address"><Copy size={15}/></button></div>
            <p className="mt-3 break-all text-[12px] font-black leading-5 text-[#342A28]">{address}</p>
            <div className="mt-3 space-y-2 text-[9px]">
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
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#FAF7F5] p-3"><Clock3 size={16} className="mt-0.5 shrink-0 text-[#D86F68]"/><p className="text-[9px] leading-5 text-[#8E7772]">Crypto deposits are reviewed after on-chain confirmations. Allow up to <b>25 minutes</b> after sending.</p></div>
        </Card>}

        {method === 'fiat' && <Card className="rounded-[28px] border-[#E1D5D1] bg-[#FFFDFB] p-5 shadow-none"><div className="mb-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#8E7772]"><span className="rounded-full bg-[#D86F68] px-2 py-1 text-white">1</span> Bank transfer deposit</div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#8E7772]">Fiat deposit</p>
          <h2 className="mt-1 text-[19px] font-black">Deposit NGN by bank transfer</h2>
          <p className="mt-1 text-[9px] leading-4 text-[#8E7772]">Transfer NGN from your bank app to the NexMonie merchant account assigned to this deposit.</p>
          <div className="mt-4 space-y-3">
            <div><p className="mb-2 text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Receiving bank</p><div className="grid grid-cols-1 gap-2">{receivingAccounts.map((account) => <button key={account.bankName} type="button" onClick={() => setReceivingBank(account.bankName)} className={`w-full rounded-2xl border p-3 text-left transition ${receivingBank === account.bankName ? 'border-[#D86F68] bg-[#F9E8E5]' : 'border-[#E1D5D1] bg-[#FFFDFB]'}`}><b className="block text-[12px]">{account.bankName}</b><span className="mt-1 block text-[9px] text-[#8E7772]">{account.accountName}</span></button>)}</div></div>
            <div className="rounded-[22px] bg-[#F8F2F0] p-4"><p className="text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Send transfer to</p><p className="mt-2 text-[12px] font-black">{selectedReceiving?.bankName}</p><p className="mt-1 text-[10px] text-[#8E7772]">{selectedReceiving?.accountName}</p><div className="mt-3 flex items-center justify-between gap-3"><b className="text-[20px] tracking-wide">{selectedReceiving?.accountNumber}</b><button onClick={() => copy(selectedReceiving.accountNumber, true)} className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#342A28] px-3 text-[9px] font-black text-white" aria-label="Copy receiving account number"><Copy size={14}/>{copiedAccount ? 'Copied' : 'Copy'}</button></div></div>
          </div>
          <div className="mt-3 space-y-3">
            <div><label className="mb-1 block text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Account name</label><input value={senderAccountName} onChange={e=>setSenderAccountName(e.target.value)} placeholder="Name on your sending account" className="h-12 w-full rounded-xl border border-[#E1D5D1] bg-[#FFFDFB] px-3 text-[11px] outline-none"/></div>
            <div><label className="mb-1 block text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Bank name</label><input value={bankQuery || senderBank} onFocus={() => setShowBankList(true)} onChange={e=>{setBankQuery(e.target.value); setSenderBank('')}} placeholder="Search and select your bank" className="h-12 w-full rounded-xl border border-[#E1D5D1] bg-[#FFFDFB] px-3 text-[11px] outline-none"/>{showBankList && <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-[#E1D5D1] bg-[#FFFDFB] p-2" role="listbox" aria-label="Nigerian banks">{matchingBanks.length ? matchingBanks.map((bank) => <button key={bank.id} type="button" onClick={() => {setSenderBank(bank.name); setBankQuery(''); setShowBankList(false)}} className={`block min-h-11 w-full rounded-xl px-3 text-left text-[10px] ${senderBank === bank.name ? 'bg-[#F9E8E5] font-black' : 'hover:bg-[#FAF7F5]'}`}>{bank.name}</button>) : <p className="p-3 text-[10px] text-[#8E7772]">No matching institutions found. Try another search.</p>}</div>}</div>
            <div><label className="mb-1 block text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Account number</label><input inputMode="numeric" value={senderAccountNumber} onChange={e=>setSenderAccountNumber(e.target.value.replace(/\\D/g, '').slice(0, 10))} placeholder="10-digit account number" className="h-12 w-full rounded-xl border border-[#E1D5D1] bg-[#FFFDFB] px-3 text-[11px] outline-none"/></div>
            <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Transfer reference (optional)" className="h-12 w-full rounded-xl border border-[#E1D5D1] bg-[#FFFDFB] px-3 text-[11px] outline-none"/>
          </div>
          <div className="mt-4"><AmountEntry value={amount} onChange={setAmount} currency="NGN" label="Deposit amount (NGN)"/></div>
          <div className="mt-2 rounded-2xl bg-[#F9E8E5] p-3"><div className="flex items-center justify-between gap-3"><span className="text-[9px] font-black uppercase tracking-widest text-[#8E7772]">Estimated credit</span><b className="text-[15px] font-black">{usdNgnRate && fiatAmount > 0 ? `≈ ${(fiatAmount / usdNgnRate).toFixed(2)} USDT` : '— USDT'}</b></div><p className="mt-1 text-[9px] leading-4 text-[#8E7772]">{usdNgnRate ? `Calculated from ₦${usdNgnRate.toLocaleString('en-NG', { maximumFractionDigits: 2 })} per $1 using Yahoo Finance${rateUpdatedAt ? ` · ${new Date(rateUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}. Final credit is recorded after verification.` : 'Live exchange rate unavailable. We will calculate the credit when the deposit is verified.'}</p></div>
          <div className="mt-4 rounded-2xl bg-[#FAF7F5] p-4"><p className="text-[8px] font-black uppercase tracking-widest text-[#8E7772]">Deposit instructions</p><p className="mt-2 text-[10px] leading-5 text-[#6F5C57]">Transfer the exact amount to the selected nexMonie receiving account, then submit your transfer details for pending review. Bank transfers may take up to 15 minutes to review.</p></div>
          <button type="button" disabled={submitting || !canSubmitFiat} onClick={submitFiat} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#342A28] text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Deposit <ArrowRight size={14}/></button>
        </Card>}

      </>}

      {stage === 'pending' && <Card className="rounded-[30px] border-[#E1D5D1] bg-[#FFFDFB] p-7 text-center shadow-none"><CheckCircle2 size={52} className="mx-auto text-[#B86B64]"/><h2 className="mt-4 text-[21px] font-black">Deposit submitted</h2><div className="mt-4 rounded-2xl bg-[#F9E8E5] p-4"><p className="text-[9px] font-black uppercase tracking-widest text-[#8E7772]">Pending review</p><p className="mt-1 text-[26px] font-black tabular-nums">{countdownLabel}</p><p className="text-[9px] text-[#8E7772]">Estimated {method === 'crypto' ? '25-minute crypto' : '15-minute bank transfer'} review window</p></div><p className="mt-4 text-[10px] leading-5 text-[#8E7772]">Your deposit proof is recorded for operational review. The balance is not credited until the configured confirmation process approves it.</p><button onClick={() => router.push('/transactions')} className="mt-5 w-full rounded-2xl bg-[#342A28] py-3 text-[10px] font-black text-white">View activity</button></Card>}
    </div>
    <BottomNav/>
  </main>
}
