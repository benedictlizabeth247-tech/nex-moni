"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Plus, Send, Landmark, CreditCard, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet } from '@/types'

interface CommandCenterProps {
  wallet: Wallet | null;
  loading: boolean;
}

export function CommandCenter({ wallet, loading }: CommandCenterProps) {
  const router = useRouter()
  const [showBalance, setShowBalance] = useState(true)

  const displayBalance = wallet?.available || 0
  const usdtBalance = displayBalance

  return (
    <div className="-mx-4 mb-5 w-[calc(100%+2rem)]">
      <Card className="relative w-full overflow-hidden rounded-2xl border border-[#343A40] bg-[#171A1E] pt-5 text-[#F4F1EF] shadow-[0_18px_48px_rgba(0,0,0,.24)] sm:rounded-[22px] sm:pt-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#C5A46D]" aria-hidden="true" />
        <div className="px-4 sm:px-6 relative z-10">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-[#B7BEC5]">Available Portfolio</span>
            <button 
              onClick={() => setShowBalance(!showBalance)} 
              className="rounded-md p-2 text-[#C5A46D] transition-colors hover:bg-[#2A2520] hover:text-[#F3DFC0] active:scale-90"
            >
              {showBalance ? <Eye size={14} className="sm:w-4 sm:h-4" /> : <EyeOff size={14} className="sm:w-4 sm:h-4" />}
            </button>
          </div>
          
          <div className="flex items-baseline gap-0.5 sm:gap-1 mb-2 sm:mb-4 overflow-hidden">
            {loading ? (
              <Skeleton className="h-8 w-32 bg-white/10" />
            ) : (
              <span className={`text-[22px] sm:text-[32px] font-bold leading-none transition-all duration-300 truncate ${!showBalance && "blur-lg"}`}>
                {showBalance ? `${usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} USDT` : "•••••••"}
              </span>
            )}
          </div>

          <button 
            onClick={() => router.push('/finances')} 
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#8F7650] bg-[#2A2520] px-3 py-1.5 text-[10px] font-bold text-[#F3DFC0] mb-4 sm:mb-6 hover:bg-[#3A3028] transition-all active:scale-95"
          >
            Portfolio Breakdown <ChevronRight size={10} className="sm:w-3 sm:h-3" />
          </button>
        </div>

        <div className="h-[1px] w-full bg-white/10 mb-3 sm:mb-4" />

        <div className="flex items-start justify-between px-2 sm:px-6 relative z-10">
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
    <button key={id} onClick={onClick} className="flex flex-col items-center gap-1 sm:gap-2 transition-all active:scale-90 flex-1 group">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#343A40] bg-[#202328] text-[#C5A46D] transition-all group-hover:border-[#8F7650] group-hover:bg-[#2A2520]">
        {React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, { 
          className: "h-4 w-4 sm:h-[18px] sm:w-[18px]" 
        })}
      </div>
      <span className="text-[10px] font-bold text-[#B7BEC5] text-center leading-tight uppercase tracking-wider">
        {label}
      </span>
    </button>
  )
}
