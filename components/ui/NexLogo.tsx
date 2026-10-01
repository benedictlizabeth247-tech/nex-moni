import Image from 'next/image'
import { cn } from '@/lib/utils'
import { brand } from '@/lib/brand'

interface NexLogoProps {
  className?: string
  iconOnly?: boolean
}

export function NexLogo({ className, iconOnly = false }: NexLogoProps) {
  return (
    <div className={cn('flex items-center overflow-hidden', className)}>
      <Image src={brand.logo} alt={brand.name} width={iconOnly ? 72 : 210} height={iconOnly ? 44 : 64} priority className={cn('h-auto object-contain', iconOnly ? 'w-[72px]' : 'w-[180px] sm:w-[210px]')} />
    </div>
  )
}
