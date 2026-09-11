import React from 'react'
import { cn } from '@/lib/utils'

interface NexLogoProps {
  className?: string
  iconOnly?: boolean
}

export function NexLogo({ className, iconOnly = false }: NexLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative w-8 h-8 flex-shrink-0">
        <div className="w-full h-full bg-primary rounded-[10px] flex items-center justify-center shadow-sm">
          <span className="text-primary-foreground font-black text-[18px] leading-none">A</span>
        </div>
      </div>
      
      {!iconOnly && (
        <div className="flex items-center text-[18px] tracking-tight text-foreground">
          <span className="font-semibold">APEDAT</span>
        </div>
      )}
    </div>
  )
}
