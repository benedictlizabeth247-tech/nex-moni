"use client"

import Image from "next/image"
import { useState } from "react"
import type { AssetType } from "@/services/market-data/types"

const typeLabels: Record<AssetType, string> = {
  crypto: "CR",
  stock: "EQ",
  etf: "ETF",
  forex: "FX",
  commodity: "CM",
  index: "IX",
}

export function AssetAvatar({
  symbol,
  name,
  type,
  iconUrl,
  size = 28,
}: {
  symbol: string
  name: string
  type: AssetType
  iconUrl?: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const initials = symbol.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || typeLabels[type]

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[8px] font-black tracking-tight text-muted-foreground"
      style={{ width: size, height: size }}
      title={name}
      aria-label={`${name} ${symbol}`}
    >
      {iconUrl && !failed ? (
        <Image
          src={iconUrl}
          alt={`${name} logo`}
          width={size}
          height={size}
          className="h-full w-full object-contain p-1"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  )
}
