"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowDownCircle,
  Banknote,
    TrendingUp,
  BarChart3,
  Repeat,
  CandlestickChart,
  LineChart,
  ArrowLeftRight
,
  Grid2x2
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Metadata-driven Quick Actions.
 * Architecture: UI consumes from a predefined schema.
 */
const ACTIONS = [
  { id: 'deposit', icon: <ArrowDownCircle size={22} />, label: "Fund", iconColor: "text-[#D86F68]", iconSurface: "bg-primary/10", path: "/fund" },
  { id: 'send', icon: <Banknote size={21} />, label: "Send Money", iconColor: "text-[#D86F68]", iconSurface: "bg-primary/10", path: "/send-money" },
  { id: 'receive', icon: <ArrowDownCircle size={21} />, label: "Receive", iconColor: "text-[#D86F68]", iconSurface: "bg-primary/10", path: "/wallet-details" },
  { id: 'markets', icon: <CandlestickChart size={20} strokeWidth={2.4} />, label: "Markets", iconColor: "text-info", iconSurface: "bg-info/10", path: "/markets" },
  { id: 'futures', icon: <LineChart size={20} strokeWidth={2.4} />, label: "Futures", iconColor: "text-warning", iconSurface: "bg-warning/10", path: "/futures" },
  { id: 'spot', icon: <ArrowLeftRight size={20} strokeWidth={2.4} />, label: "Spot Trading", iconColor: "text-positive", iconSurface: "bg-positive/10", path: "/spot" },
  { id: 'scan', icon: <Grid2x2 size={21} />, label: "Scan & Pay", iconColor: "text-[#D86F68]", iconSurface: "bg-primary/10", path: "/scan-pay" },
  { id: 'withdraw', icon: <ArrowDownCircle size={21} />, label: "Withdraw", iconColor: "text-[#D86F68]", iconSurface: "bg-primary/10", path: "/withdraw" },
  { id: 'more', icon: <Grid2x2 size={22} />, label: "More", iconColor: "text-[#D86F68]", iconSurface: "bg-primary/10", path: "/actions-hub" },
]

export function QuickActionGrid() {
  const router = useRouter()

  return (
    <div
      className="relative mb-6 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-[15px] sm:text-[17px] font-bold text-foreground tracking-tight">Quick Actions</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pb-1">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => router.push(action.path)}
            className="group relative flex min-h-[78px] w-full min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card px-1.5 py-3 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[.985]"
          >
            <div className={cn("flex size-9 items-center justify-center rounded-xl border border-current/10 transition-transform group-hover:scale-110", action.iconSurface, action.iconColor)}>
              {React.cloneElement(action.icon as React.ReactElement<Record<string, unknown>>, {
                className: "h-[19px] w-[19px]"
              })}
            </div>
            <span className="w-full px-0.5 text-center text-[9px] font-bold leading-[1.15] text-foreground">
              {action.label}
            </span>
          </button>
        ))}
      </div>

    </div>
  )
}
