'use client'

import { Check } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { formatNaira, getProductById, getProviderById } from '@/services/savingsProvidersService'

export default function SavingsConfirmationPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const provider = getProviderById(id)

  if (!provider) {
    return (
      <main className="min-h-screen bg-[#F8FAF9] p-6">
        <button onClick={() => router.push('/')} className="text-primary">
          Go home
        </button>
      </main>
    )
  }

  const product = getProductById(provider, searchParams.get('product'))
  const amount = Number(searchParams.get('amount') || 0)

  return (
    <main className="flex min-h-screen flex-col bg-[#F8FAF9] px-6 pb-10 pt-24">
      <div className="flex flex-1 flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25">
          <Check size={40} strokeWidth={3} aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-[24px] font-bold text-[#1A1A1A]">Your savings plan is ready</h1>
        <p className="mt-2 text-[15px] text-gray-600">
          {formatNaira(amount)} with {provider.name} — {product.name}
        </p>

        <div className="mt-8 w-full rounded-[24px] bg-white p-5 text-left shadow-soft">
          <Row label="Provider" value={provider.name} />
          <Row label="Savings option" value={product.name} />
          <Row label="Amount" value={formatNaira(amount)} />
          <Row label="Funding source" value="NexWallet" last />
        </div>

        <p className="mt-6 text-[12px] leading-relaxed text-gray-500">
          No money has been moved yet. Your plan will activate once your {provider.name} connection is live.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => router.push('/savings/providers')}
          className="w-full rounded-[22px] bg-primary py-4 text-[15px] font-bold text-white shadow-lg shadow-primary/20 active:scale-[.99]"
        >
          Save with another provider
        </button>
        <button
          onClick={() => router.push('/')}
          className="w-full rounded-[22px] border border-gray-200 bg-white py-4 text-[15px] font-bold text-[#1A1A1A] active:scale-[.99]"
        >
          Done
        </button>
      </div>
    </main>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${last ? '' : 'border-b border-gray-100'}`}>
      <span className="text-[13px] text-gray-500">{label}</span>
      <span className="text-[13px] font-bold text-[#1A1A1A]">{value}</span>
    </div>
  )
}
