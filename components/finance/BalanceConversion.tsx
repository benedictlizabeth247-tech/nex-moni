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
    return <p className={`text-[10px] leading-4 text-white/55 ${className}`}>USD equivalent updates with the live Yahoo Finance rate</p>
  }

  const dollars = amount / rate
  const timestamp = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null
  return <p className={`text-[10px] leading-4 text-white/60 ${className}`}>≈ ${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD · Yahoo Finance USD/NGN ₦{rate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}{timestamp ? ` · ${timestamp}` : ""}</p>
}
