'use client'

import { ChevronRight } from 'lucide-react'
import type { SavingsProvider } from '@/services/savingsProvidersService'

export function ProviderRow({
  provider,
  onClick,
}: {
  provider: SavingsProvider
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 border-b border-gray-100 px-1 py-4 text-left transition-colors last:border-b-0 active:bg-gray-50"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-black text-primary"
        aria-hidden="true"
      >
        {provider.logo}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-bold text-[#1A1A1A]">{provider.name}</h2>
        <p className="truncate text-[12px] text-gray-400">{provider.category}</p>
        <p className="truncate text-[12px] text-gray-500">{provider.tagline}</p>
        <p className="mt-1 text-[12px] font-bold text-primary">{provider.rate}</p>
      </div>
      <ChevronRight className="shrink-0 text-gray-300" size={20} aria-hidden="true" />
      <span className="sr-only">Open {provider.name}</span>
    </button>
  )
}
