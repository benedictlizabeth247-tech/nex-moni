"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Plus, Send, Landmark, CreditCard } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet } from '@/types'
import { BalanceConversion } from '@/components/finance/BalanceConversion'

interface CommandCenterProps {
  wallet: Wallet | null;
  equity?: number | null;
  loading: boolean;
}

export function CommandCenter({ wallet, equity, loading }: CommandCenterProps) {
  const router = useRouter()
  const [showBalance, setShowBalance] = useState(true)

  const displayBalance = equity ?? wallet?.available ?? 0
  const usdtBalance = displayBalance

  return (
    <div className="mb-5 w-full">
      <Card className="relative w-full overflow-hidden rounded-3xl border border-primary/20 bg-[#5C5552] pb-4 pt-6 text-white shadow-[0_12px_32px_rgba(78,66,62,.14)] sm:pb-5 sm:pt-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-primary-foreground/35" aria-hidden="true" />
        <div className="relative z-10 px-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-white/65">Available Portfolio</span>
            <button 
              onClick={() => setShowBalance(!showBalance)} 
              className="rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground active:scale-95"
            >
              {showBalance ? <Eye size={14} className="sm:w-4 sm:h-4" /> : <EyeOff size={14} className="sm:w-4 sm:h-4" />}
            </button>
          </div>
          
          <div className="mb-5 flex items-baseline gap-1 overflow-hidden sm:mb-7">
            {loading ? (
              <Skeleton className="h-8 w-32 bg-white/10" />
            ) : (
              showBalance ? <BalanceConversion amount={usdtBalance} className="text-white" /> : <span className="text-[22px] sm:text-[32px] font-bold leading-none blur-lg">•••••••</span>
            )}
          </div>
        

        </div>

        <div className="mb-5 h-px w-full bg-primary-foreground/15 sm:mb-6" />

        <div className="relative z-10 flex items-start justify-between gap-2 px-2 sm:gap-4 sm:px-6">
          <ActionItem id="fund" onClick={() => router.push('/fund')} icon={<Plus size={16} />} label="Fund" />
          <ActionItem id="send" onClick={() => router.push('/send-money')} icon={<Send size={16} />} label="Send" />
          <ActionItem id="receive" onClick={() => router.push('/wallet-details')} icon={<Landmark size={16} />} label="Receive" />
          <ActionItem id="details" onClick={() => router.push('/wallet-details')} icon={<CreditCard size={16} />} label="Details" />
        </div>
      </Card>
    </div>
  )
}

function ActionItem({ id, icon, label, onClick }: { id: string, icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button key={id} onClick={onClick} className="group flex min-w-0 flex-1 flex-col items-center gap-2 transition-all active:scale-90 sm:gap-2.5">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-primary-foreground/25 bg-white/10 text-primary-foreground shadow-sm transition-colors group-hover:bg-primary-foreground/15 sm:size-14">
        {React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, { 
          className: "h-5 w-5 sm:h-6 sm:w-6" 
        })}
      </div>
        <span className="text-center text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-primary-foreground/80 sm:text-xs">
        {label}
      </span>
    </button>
  )
}
