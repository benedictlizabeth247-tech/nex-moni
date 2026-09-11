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
        <div className="w-full h-full bg-[#005F56] rounded-full flex items-center justify-center shadow-sm">
          <span className="text-white font-black text-[18px] italic leading-none lowercase">n</span>
        </div>
      </div>
      
      {!iconOnly && (
        <div className="flex items-center text-[18px] tracking-tight text-[#1A1A1A]">
          <span className="font-light lowercase opacity-70">nex</span>
          <span className="font-bold ml-1">Monie</span>
        </div>
      )}
    </div>
  )
}
