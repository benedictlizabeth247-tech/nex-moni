'use client'

import { Check, ChevronLeft, ShieldCheck } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BottomNav } from '@/components/layout/BottomNav'
import { getProviderById } from '@/services/savingsProvidersService'

export default function ProviderDetailsPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const provider = getProviderById(id)
  const [selected, setSelected] = useState(provider?.products[0]?.id ?? '')

  if (!provider) {
    return (
      <main className="min-h-screen bg-[#F8FAF9] p-6">
        <button onClick={() => router.back()} className="text-primary">
          Go back
        </button>
        <p className="mt-8 text-gray-500">Provider not found.</p>
      </main>
    )
  }

  const stats = [
    { label: 'Products', value: String(provider.products.length) },
    { label: 'Rate', value: provider.rate },
    { label: 'Minimum', value: provider.minimumAmount ? `₦${provider.minimumAmount.toLocaleString()}` : 'None' },
  ]

  return (
    <main className="min-h-screen bg-[#F8FAF9] pb-40">
      <header className="sticky top-0 z-30 bg-white px-6 pb-5 pt-8 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            aria-label="Back to providers"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-[#1A1A1A] active:scale-90"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-[17px] font-bold text-[#1A1A1A]">Provider</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="space-y-5 px-6 py-7">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl font-black text-primary" aria-hidden="true">
            {provider.logo}
          </div>
          <h2 className="mt-4 text-[22px] font-bold text-[#1A1A1A]">{provider.name}</h2>
          <p className="text-[12px] font-medium uppercase tracking-wide text-gray-400">{provider.category}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{provider.description}</p>
        </div>

        <div className="flex items-center justify-between rounded-[24px] bg-white p-5 shadow-soft">
          {stats.map((stat) => (
            <div key={stat.label} className="flex-1 text-center">
              <p className="text-[14px] font-bold text-[#1A1A1A]">{stat.value}</p>
              <p className="mt-1 text-[11px] text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-3 text-[15px] font-bold text-[#1A1A1A]">Choose a savings option</h3>
          <div className="space-y-3">
            {provider.products.map((product) => {
              const isSelected = product.id === selected
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelected(product.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center gap-3 rounded-[22px] border-2 bg-white p-4 text-left transition-colors ${
                    isSelected ? 'border-primary' : 'border-transparent'
                  } shadow-soft`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#1A1A1A]">{product.name}</p>
                    <p className="truncate text-[12px] text-gray-500">{product.description}</p>
                  </div>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? 'border-primary bg-primary text-white' : 'border-gray-200 text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    <Check size={14} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-white p-4 text-[11px] leading-relaxed text-gray-500 shadow-soft">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <p>{provider.terms}</p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white px-6 pb-8 pt-4">
        <button
          onClick={() => router.push(`/savings/providers/${provider.id}/amount?product=${selected}`)}
          className="w-full rounded-[22px] bg-primary py-4 text-[15px] font-bold text-white shadow-lg shadow-primary/20 active:scale-[.99]"
        >
          Continue
        </button>
      </div>
    </main>
  )
}
