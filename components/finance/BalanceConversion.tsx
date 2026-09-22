"use client"

import { useEffect, useState } from "react"

export function BalanceConversion({ amount, className = "" }: { amount: number; className?: string }) {
  const [rate, setRate] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/valuation", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return
        const nextRate = Number(data?.usdNgn?.rate)
        if (Number.isFinite(nextRate) && nextRate > 0) {
          setRate(nextRate)
          setUpdatedAt(data?.usdNgn?.receivedAt ?? null)
        }
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  if (!Number.isFinite(amount) || amount < 0 || !rate) {
    return <div className={className}><p className="text-[30px] font-black leading-none tracking-[-0.03em] sm:text-[38px]">— USD</p><p className="mt-1 text-[10px] leading-4 text-white/55">Waiting for the live Yahoo Finance USD/NGN rate</p></div>
  }

  const dollars = amount / rate
  const timestamp = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null
  return <div className={className}><p className="text-[30px] font-black leading-none tracking-[-0.03em] sm:text-[38px]">${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p><p className="mt-1 text-[10px] leading-4 text-white/60">₦{amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at ₦{rate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}/$1 · Yahoo Finance{timestamp ? ` · ${timestamp}` : ""}</p></div>
}
