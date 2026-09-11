'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type GlobalBackgroundProps = {
  children: ReactNode
  className?: string
  patternClassName?: string
}

export function GlobalBackground({ children, className, patternClassName }: GlobalBackgroundProps) {
  return (
    <div className={cn('nex-background relative isolate min-h-dvh overflow-x-clip bg-background text-foreground', className)}>
      <div aria-hidden="true" className={cn('nex-background__pattern', patternClassName)} />
      <div className="relative z-10 min-h-dvh">{children}</div>
    </div>
  )
}
