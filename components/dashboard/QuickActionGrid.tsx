"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowDownCircle,
  Smartphone,
  Banknote,
  ScanLine,
  TrendingUp, 
  Repeat, 
  Wifi, 
  FileText, 
  Grid2x2
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Metadata-driven Quick Actions.
 * Architecture: UI consumes from a predefined schema.
 */
const ACTIONS = [
  { id: 'deposit', icon: <ArrowDownCircle size={22} />, label: "Fund", iconColor: "text-[#D86F68]", path: "/fund" },
  { id: 'send', icon: <Banknote size={21} />, label: "Send Money", iconColor: "text-[#D86F68]", path: "/send-money" },
  { id: 'receive', icon: <ArrowDownCircle size={21} />, label: "Receive", iconColor: "text-[#D86F68]", path: "/wallet-details" },
  { id: 'futures', icon: <TrendingUp size={20} />, label: "Futures", iconColor: "text-accent", path: "/futures" },
  { id: 'spot', icon: <Repeat size={20} />, label: "Spot Trading", iconColor: "text-accent", path: "/spot" },
  { id: 'data', icon: <Wifi size={22} />, label: "Buy Data", iconColor: "text-[#D86F68]", path: "/buy-data" },
  { id: 'airtime', icon: <Smartphone size={21} />, label: "Airtime", iconColor: "text-[#D86F68]", path: "/buy-airtime" },
  { id: 'scan', icon: <ScanLine size={21} />, label: "Scan & Pay", iconColor: "text-[#D86F68]", path: "/scan-pay" },
  { id: 'bills', icon: <FileText size={22} />, label: "Bills", iconColor: "text-[#D86F68]", path: "/pay-bills" },
  { id: 'withdraw', icon: <ArrowDownCircle size={21} />, label: "Withdraw", iconColor: "text-[#D86F68]", path: "/withdraw" },
  { id: 'more', icon: <Grid2x2 size={22} />, label: "More", iconColor: "text-[#D86F68]", path: "/actions-hub" },
]

export function QuickActionGrid() {
  const router = useRouter()
  const touchStartX = React.useRef<number | null>(null)
  const touchStartY = React.useRef<number | null>(null)
  const moved = React.useRef(false)
  const [openingHub, setOpeningHub] = React.useState(false)

  // This gesture belongs exclusively to Quick Actions. Stopping propagation
  // prevents Home's full-page pager from consuming the same swipe.
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStartX.current = touch?.clientX ?? null
    touchStartY.current = touch?.clientY ?? null
    moved.current = false
    event.stopPropagation()
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null || touchStartY.current == null) return
    const touch = event.touches[0]
    if (!touch) return
    const dx = touch.clientX - touchStartX.current
    const dy = touch.clientY - touchStartY.current
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) moved.current = true
    event.stopPropagation()
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return
    const end = event.changedTouches[0]
    const deltaX = (end?.clientX ?? touchStartX.current) - touchStartX.current
    const deltaY = (end?.clientY ?? touchStartY.current ?? 0) - (touchStartY.current ?? 0)
    touchStartX.current = null
    touchStartY.current = null
    event.stopPropagation()

    // ONLY a predominantly horizontal left swipe opens Utilities Hub.
    // Right swipes are intentionally ignored. A tap still activates an action.
    if (deltaX < -70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      moved.current = true
      setOpeningHub(true)
      window.setTimeout(() => router.push('/utilities-hub'), 280)
    }
  }

  return (
    <div
      className={"mb-6 relative overflow-hidden select-none touch-pan-x transition-transform duration-300 ease-out " + (openingHub ? "-translate-x-6 opacity-95" : "")}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-[15px] sm:text-[17px] font-bold text-foreground tracking-tight">Quick Actions</h2>
        <span className="text-[9px] font-bold text-muted-foreground">Swipe ← for services</span>
      </div>

      <div className="flex gap-2 sm:gap-2.5 overflow-x-auto overscroll-x-contain touch-pan-x pb-1 scrollbar-none snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => { if (!moved.current && !openingHub) router.push(action.path) }}
            className="flex w-[82px] min-w-[82px] snap-start flex-col items-center gap-2 rounded-[16px] border border-[#E5D8D5] bg-[#FFFDFB] px-1.5 py-3 shadow-[0_6px_20px_rgba(25,55,45,.045)] transition-all hover:border-[#BFD8D0] active:scale-[.985] group relative"
          >
            <div className={cn("transition-transform group-hover:scale-110", action.iconColor)}>
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

      <button
        type="button"
        onClick={() => router.push('/utilities-hub')}
        className="mt-2 flex w-full items-center justify-center rounded-xl border border-dashed border-[#C9D8D2] bg-white/70 py-2 text-[10px] font-bold text-[#087F5B]"
      >
        Swipe left to open the Utilities Hub ←
      </button>
    </div>
  )
}
