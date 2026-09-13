import React from 'react'
import { cn } from '@/lib/utils'

interface NexLogoProps {
  className?: string
  iconOnly?: boolean
}

export function NexLogo({ className, iconOnly = false }: NexLogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <span className={cn("font-semibold tracking-[-0.045em] text-[#2E3437]", iconOnly ? "text-[20px]" : "text-[19px]")}>nexMonie</span>
    </div>
  )
}
