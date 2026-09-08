'use client'

import { ChevronLeft } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { NumericKeypad } from '@/components/savings/NumericKeypad'
import { getProductById, getProviderById, isValidSavingsAmount } from '@/services/savingsProvidersService'

export default function SavingsAmountPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const provider = getProviderById(id)
  const [digits, setDigits] = useState('')

  if (!provider) {
    return (
      <main className="min-h-screen bg-[#F8FAF9] p-6">
        <button onClick={() => router.back()} className="text-primary">
          Go back
        </button>
      </main>
    )
  }

  const product = getProductById(provider, searchParams.get('product'))
  const numericAmount = Number(digits || '0')
  const valid = isValidSavingsAmount(numericAmount, provider.minimumAmount)
  const display = digits ? numericAmount.toLocaleString('en-NG') : '0'

  const handleKey = (digit: string) => {
    setDigits((current) => {
      if (current === '' && digit === '0') return current
      if (current.length >= 12) return current
      return current + digit
    })
  }

  const handleSave = () => {
    if (!valid) return
    router.push(
      `/savings/providers/${provider.id}/amount/confirmation?product=${product.id}&amount=${numericAmount}`,
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F8FAF9]">
      <header className="bg-white px-6 pb-5 pt-8 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            aria-label="Back to provider"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-[#1A1A1A] active:scale-90"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-[17px] font-bold text-[#1A1A1A]">Choose an amount</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-1 flex-col px-6 py-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-soft">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary"
              aria-hidden="true"
            >
              {provider.logo}
            </span>
            <span className="text-[12px] font-bold text-[#1A1A1A]">{provider.name}</span>
            <span className="text-[12px] text-gray-400">· {product.name}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="flex items-start">
            <span className={`mt-2 text-3xl font-bold ${digits ? 'text-primary' : 'text-gray-300'}`}>₦</span>
            <span className={`text-[52px] font-black leading-none ${digits ? 'text-[#1A1A1A]' : 'text-gray-300'}`}>
              {display}
            </span>
          </div>
          <p className="mt-4 text-[12px] text-gray-400">Saving from your NexWallet</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleSave}
            disabled={!valid}
            className="w-full rounded-[22px] bg-primary py-4 text-[15px] font-bold text-white shadow-lg shadow-primary/20 transition-opacity active:scale-[.99] disabled:opacity-40"
          >
            Save
          </button>
          <NumericKeypad onKey={handleKey} onDelete={() => setDigits((current) => current.slice(0, -1))} />
        </div>
      </div>
    </main>
  )
}
