'use client'

import { ChevronLeft, Landmark } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProviderRow } from '@/components/savings/ProviderRow'
import { getSavingsProviders } from '@/services/savingsProvidersService'

export default function SavingsProvidersPage() {
  const router = useRouter()
  const providers = getSavingsProviders()

  return (
    <main className="min-h-screen bg-[#F8FAF9] pb-32">
      <header className="sticky top-0 z-30 bg-white px-6 pb-5 pt-8 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            aria-label="Back to home"
            onClick={() => router.push('/')}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-[#1A1A1A] active:scale-90"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-[17px] font-bold text-[#1A1A1A]">Savings</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-6 py-7">
        <h2 className="text-[22px] font-bold leading-tight text-[#1A1A1A]">Where do you want to save?</h2>
        <p className="mb-6 mt-2 text-[13px] leading-relaxed text-gray-500">
          Choose a savings platform that fits the way you want to save.
        </p>

        <div className="rounded-[28px] bg-white p-5 shadow-soft">
          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onClick={() => router.push(`/savings/providers/${provider.id}`)}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4 text-[11px] leading-relaxed text-gray-600">
          <Landmark className="shrink-0 text-primary" size={18} aria-hidden="true" />
          <p>
            Rates and terms are set by each provider and can change. nexMonie shows the provider&apos;s own
            information so you can choose where to save.
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
