"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  Copy, 
  CheckCircle2, 
  Share2, 
  QrCode, 
  ShieldCheck, 
  BadgeCheck,
  Info
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NexLogo } from '@/components/ui/NexLogo'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { getWalletIdentity, type WalletIdentity } from '@/services/walletService'
import { useUser } from '@/supabase'

export default function WalletDetailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [identity, setIdentity] = useState<WalletIdentity | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    let active = true

    if (!user) {
      setIdentity(null)
      setLoading(false)
      return
    }

    ;(async () => {
      try {
        const data = await getWalletIdentity(user.id)
        if (active) setIdentity(data)
      } catch (error) {
        console.error('[wallet-details] failed to load wallet identity', error)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [user, authLoading])

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast({ title: "Copied!", description: `${field} copied to clipboard.` })
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <main className="min-h-screen pb-32 bg-[#F8FAF9]">
      <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A] active:scale-90 transition-all border border-gray-100">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-[18px] font-bold text-[#1A1A1A]">Wallet Details</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-6 py-8">
        <Card className="bg-white p-8 border-none shadow-nex-soft rounded-[40px] flex flex-col items-center text-center mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <div className="flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <BadgeCheck size={12} className="text-emerald-500" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{identity?.verificationStatus}</span>
             </div>
          </div>

          <div className="w-24 h-24 bg-gray-50 rounded-[32px] flex items-center justify-center mb-6 border border-gray-100 shadow-inner">
             <QrCode size={48} className="text-gray-300" />
          </div>
          
          <div className="text-[22px] font-bold text-[#1A1A1A] mb-1 leading-tight min-h-[28px] flex items-center justify-center">
            {loading ? <Skeleton className="h-6 w-40" /> : identity?.accountName}
          </div>
          <div className="text-[13px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-6 min-h-[20px] flex items-center justify-center">
            {loading ? <Skeleton className="h-4 w-24" /> : identity?.tier}
          </div>

          <div className="mb-4 w-full rounded-2xl bg-[#EEF2F1] border border-[#D6E1DE] p-4 text-left">
             <p className="text-[9px] font-black uppercase tracking-widest text-[#708A85]">Exchange assets</p>
             <p className="mt-1 text-[11px] text-[#55736E]">View Funding, Spot and Futures balances and move available funds between trading accounts.</p>
             <button onClick={() => router.push('/assets')} className="mt-3 h-10 w-full rounded-xl bg-[#183A36] text-white text-[10px] font-black">Open Assets Overview</button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
             <button onClick={() => router.push('/send-money')} className="h-12 bg-primary/5 text-primary font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs">
                <Share2 size={14} /> Send
             </button>
             <button onClick={() => router.push('/fund-account')} className="h-12 bg-primary/5 text-primary font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs">
                <QrCode size={14} /> Fund
             </button>
          </div>
        </Card>

        <section className="space-y-4">
           <IdentityRow 
             label="Wallet Number" 
             value={identity?.walletNumber || '---'} 
             loading={loading} 
             onCopy={() => handleCopy(identity?.walletNumber || '', 'Wallet Number')}
             isCopied={copiedField === 'Wallet Number'}
           />
           <IdentityRow 
             label="nexMonie ID" 
             value={identity?.nexId || '---'} 
             loading={loading} 
             onCopy={() => handleCopy(identity?.nexId || '', 'nexMonie ID')}
             isCopied={copiedField === 'nexMonie ID'}
           />
           
           <div className="pt-4 grid grid-cols-2 gap-4">
              <Card className="p-5 border-none shadow-sm rounded-3xl bg-white">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                 <div className="text-[14px] font-bold text-emerald-500 flex items-center gap-1.5">
                    <ShieldCheck size={14} /> {identity?.status}
                 </div>
              </Card>
              <Card className="p-5 border-none shadow-sm rounded-3xl bg-white">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Member Since</p>
                 <div className="text-[14px] font-bold text-[#1A1A1A]">{identity?.memberSince}</div>
              </Card>
           </div>
        </section>

        <div className="mt-10 p-6 bg-primary/5 rounded-[32px] border border-primary/10 flex gap-4">
           <Info size={20} className="text-primary shrink-0 mt-0.5" />
           <p className="text-[12px] text-gray-500 leading-relaxed font-medium">
             Your nexMonie ID and Wallet Number are unique to you. Share them with others to receive funds instantly within the nexMonie circle.
           </p>
        </div>
      </div>
      <BottomNav />
    </main>
  )
}

function IdentityRow({ label, value, loading, onCopy, isCopied }: any) {
  return (
    <Card className="p-5 border-none shadow-sm rounded-3xl bg-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
          <div className="text-[16px] font-black italic tracking-tight text-[#1A1A1A] min-h-[24px] flex items-center">
            {loading ? <Skeleton className="h-5 w-32" /> : value}
          </div>
        </div>
        <button 
          onClick={onCopy}
          className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-primary active:scale-90 transition-all"
        >
          {isCopied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
        </button>
      </div>
    </Card>
  )
}
