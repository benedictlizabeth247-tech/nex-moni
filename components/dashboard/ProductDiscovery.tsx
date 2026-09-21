
"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Landmark, Target, Umbrella, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRODUCTS = [
  {
    title: "nexMonie Wallet",
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
      <div className="mb-3 flex items-center justify-between px-5 sm:mb-5">
        <h2 className="text-[17px] font-bold text-[#1A1A1A] tracking-tight">Financial Products</h2>
        <button 
          onClick={() => router.push('/finances')}
          className="text-[13px] font-bold text-primary active:opacity-60 transition-opacity"
        >
          View Portfolio
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2.5 px-5 pb-4 sm:gap-4">
        {PRODUCTS.map((prod, idx) => (
          <div
            key={idx}
            onClick={() => router.push(prod.path)}
            className={cn(
              "relative flex min-w-0 h-[176px] cursor-pointer flex-col rounded-[24px] border border-white/50 p-3.5 shadow-soft transition-all active:scale-[0.98] group sm:h-[210px] sm:rounded-[30px] sm:p-5",
              prod.color
            )}
          >
            <div className={cn("mb-3 [&_svg]:size-5 transition-transform group-hover:scale-110 sm:mb-4 sm:[&_svg]:size-6", prod.iconColor)}>
              {prod.icon}
            </div>
            <h3 className="mb-1.5 text-[12px] font-bold leading-tight tracking-tight text-[#1A1A1A] sm:text-[15px]">{prod.title}</h3>
            <p className="max-w-[13ch] text-[9px] font-medium leading-snug text-gray-500 opacity-80 sm:text-[11px]">{prod.desc}</p>
            <button
              aria-label={`Open ${prod.title}`}
              className={cn("absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full text-white shadow-lg transition-all group-hover:translate-x-1 sm:bottom-4 sm:right-4 sm:size-9", prod.btnColor)}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
