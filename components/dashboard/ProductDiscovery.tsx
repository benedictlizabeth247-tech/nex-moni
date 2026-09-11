
"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Landmark, Target, Umbrella, ArrowRight } from 'lucide-react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const PRODUCTS = [
  {
    title: "NexWallet",
    desc: "Elite digital wallet for seamless payments",
    icon: <Wallet size={26} />,
    color: "bg-[#E8F5F3]",
    iconColor: "text-[#005F56]",
    btnColor: "bg-[#005F56]",
    path: "/wallet-details"
  },
  {
    title: "Savings",
    desc: "Earn up to 18.5% interest per annum",
    icon: <Landmark size={26} />,
    color: "bg-[#FFF8E7]",
    iconColor: "text-[#D97706]",
    btnColor: "bg-[#D97706]",
    path: "/actions-hub"
  },
  {
    title: "Investments",
    desc: "Strategic wealth growth opportunities",
    icon: <Target size={26} />,
    color: "bg-[#EEF4FF]",
    iconColor: "text-[#2563EB]",
    btnColor: "bg-[#2563EB]",
    path: "/investments"
  },
  {
    title: "Insurance",
    desc: "Bespoke protection for your assets",
    icon: <Umbrella size={26} />,
    color: "bg-[#F3EEFF]",
    iconColor: "text-[#7C3AED]",
    btnColor: "bg-[#7C3AED]",
    path: "/insurance"
  }
]

export function ProductDiscovery() {
  const router = useRouter()

  return (
    <div className="mb-10">
      <div className="px-5 flex items-center justify-between mb-5">
        <h2 className="text-[17px] font-bold text-[#1A1A1A] tracking-tight">Financial Products</h2>
        <button 
          onClick={() => router.push('/finances')}
          className="text-[13px] font-bold text-primary active:opacity-60 transition-opacity"
        >
          View Portfolio
        </button>
      </div>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-5 px-5 pb-6">
          {PRODUCTS.map((prod, idx) => (
            <div 
              key={idx} 
              onClick={() => router.push(prod.path)}
              className={cn(
                "w-[160px] p-6 rounded-[32px] flex flex-col shrink-0 relative h-[200px] shadow-soft border border-white/50 cursor-pointer group active:scale-[0.98] transition-all", 
                prod.color
              )}
            >
              <div className={cn("mb-5 transition-transform group-hover:scale-110", prod.iconColor)}>
                {prod.icon}
              </div>
              <h3 className="text-[#1A1A1A] font-bold text-[15px] leading-tight mb-2 whitespace-normal">{prod.title}</h3>
              <p className="text-gray-500 text-[11px] leading-snug whitespace-normal font-medium opacity-80">{prod.desc}</p>
              
              <button 
                className={cn("absolute bottom-5 right-6 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg group-hover:translate-x-1 transition-all", prod.btnColor)}
              >
                <ArrowRight size={18} />
              </button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
