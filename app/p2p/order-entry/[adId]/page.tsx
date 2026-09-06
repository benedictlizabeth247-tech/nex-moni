"use client"

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ChevronLeft,
  Loader2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useUser } from '@/supabase'
import { p2pService } from '@/services/p2p.service'
import { useToast } from '@/hooks/use-toast'
import type { P2PAd } from '@/types/database'

export default function P2POrderEntry() {
  const router = useRouter()
  const { adId } = useParams() as { adId: string }
  const { user, loading: userLoading } = useUser()
  const { toast } = useToast()

  const [ad, setAd] = useState<P2PAd | null>(null)
  const [adLoading, setAdLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    setAdLoading(true)
    p2pService.getAd(adId).then((data) => {
      if (active) {
        setAd(data)
        setAdLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [adId])

  const handleCreateOrder = async () => {
    if (!user || !ad || !amount) return
    const numericAmount = Number(amount)

    if (numericAmount < ad.min_limit || numericAmount > ad.max_limit) {
      toast({
        variant: 'destructive',
        title: 'Limit Violation',
        description: `Min: \u20a6${ad.min_limit.toLocaleString()}, Max: \u20a6${ad.max_limit.toLocaleString()}`,
      })
      return
    }

    setSubmitting(true)
    try {
      const cryptoAmount = numericAmount / ad.price
      const order = await p2pService.createOrder(ad.id, cryptoAmount)
      router.push(`/p2p/order/${order.id}`)
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: e instanceof Error ? e.message : 'Could not initiate trade.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (adLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  if (!ad) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-6 text-center">
        <p className="text-[15px] font-bold text-[#1A1A1A]">This ad is no longer available</p>
        <button onClick={() => router.back()} className="text-primary font-bold text-sm">
          Go back
        </button>
      </div>
    )
  }

  const quantity = amount ? (Number(amount) / ad.price).toFixed(6) : '0.000000'

  return (
    <main className="min-h-screen pb-32 bg-[#F8FAF9]">
      <header className="px-6 pt-10 pb-6 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A]"><ChevronLeft size={22} /></button>
          <h1 className="text-[18px] font-bold text-[#1A1A1A]">{ad.side === 'sell' ? 'Buy' : 'Sell'} {ad.asset}</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-6 py-8 space-y-6">
        <Card className="p-6 border-none shadow-soft rounded-[32px] bg-white">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black italic shadow-inner">
                M
             </div>
             <div>
                <h3 className="text-nex-body font-bold text-[#1A1A1A]">Elite Merchant</h3>
                <div className="flex items-center gap-2 text-nex-xs text-emerald-500 font-bold">
                   <ShieldCheck size={12} /> Verified
                </div>
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50">
             <div><p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">Price</p><p className="text-nex-sub font-black italic text-primary">₦{Number(ad.price).toLocaleString()}</p></div>
             <div className="text-right"><p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">Limits</p><p className="text-nex-sub font-bold text-[#1A1A1A]">₦{Number(ad.min_limit).toLocaleString()} - ₦{Number(ad.max_limit).toLocaleString()}</p></div>
          </div>
        </Card>

        <section className="space-y-4">
           <h3 className="text-nex-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Trade Amount</h3>
           <Card className="p-8 border-none shadow-soft rounded-[40px] bg-white space-y-6">
              <div className="space-y-2">
                 <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">I want to pay</label>
                 <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black italic text-gray-400">₦</span>
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="0.00"
                      className="h-16 pl-9 rounded-[24px] border-none bg-gray-50 font-black italic text-[24px] tracking-tight shadow-inner"
                    />
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">I will receive</label>
                 <div className="p-5 bg-primary/5 rounded-[24px] border border-primary/10 flex items-center justify-between">
                    <span className="text-nex-h4 font-black italic text-primary">{quantity}</span>
                    <span className="text-nex-sub font-bold text-primary">{ad.asset}</span>
                 </div>
              </div>
           </Card>
        </section>

        <section className="space-y-4">
           <h3 className="text-nex-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Trading Terms</h3>
           <Card className="p-6 border-none shadow-soft rounded-[28px] bg-white">
              <p className="text-[13px] text-gray-500 leading-relaxed font-medium">
                {ad.terms || 'Fast release. Please use your nexMonie account for transfer to ensure instant verification. No 3rd party payments allowed.'}
              </p>
           </Card>
        </section>

        <div className="pt-4">
           <button
             disabled={!amount || submitting || !user}
             onClick={handleCreateOrder}
             className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
           >
             {submitting ? <Loader2 className="animate-spin" /> : <>Initiate Secure Trade <ArrowRight size={20} /></>}
           </button>
           <p className="text-center text-[11px] text-gray-400 font-medium mt-4 flex items-center justify-center gap-2">
             <ShieldCheck size={14} className="text-emerald-500" /> Funds are secured in escrow during trade
           </p>
        </div>
      </div>
    </main>
  )
}
