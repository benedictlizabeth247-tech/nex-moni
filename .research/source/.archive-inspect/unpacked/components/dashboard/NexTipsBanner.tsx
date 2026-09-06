"use client"

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ChevronRight, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useUser, useCollection } from '@/supabase'
import { getPersonalizedFinancialAdvice } from '@/ai/flows/personalized-financial-advice-flow'

export function NexTipsBanner() {
  const router = useRouter()
  const { user } = useUser()
  const [advice, setAdvice] = useState<string | null>(null)
  const [loadingAdvice, setLoadingAdvice] = useState(false)

  const { data: wallets } = useCollection(user ? { table: 'wallets', userId: user.id, limit: 1 } : null)
  const wallet = wallets?.[0]

  const { data: transactions } = useCollection(user ? { table: 'transactions', userId: user.id, limit: 10 } : null)

  useEffect(() => {
    async function fetchAdvice() {
      if (!user || !wallet || advice || loadingAdvice) return
      setLoadingAdvice(true)
      try {
        const result = await getPersonalizedFinancialAdvice({
          spendingPatterns: (transactions && transactions.length > 0)
            ? `User has ${transactions.length} recent transactions.` 
            : "New user starting their nex Monie journey.",
          currentBalance: wallet.available_balance || 0,
          financialGoals: "Consistent elite growth and secure automated savings."
        })
        if (result?.tips?.[0]) {
          setAdvice(result.tips[0])
        } else {
          setAdvice("Optimize your portfolio for consistent growth with NexVault.")
        }
      } catch (e) {
        console.error("AI Insight failed:", e)
        setAdvice("Automate your daily savings and watch your wealth grow.")
      } finally {
        setLoadingAdvice(false)
      }
    }
    
    if (wallet && transactions !== undefined) {
      fetchAdvice()
    }
  }, [user, wallet, transactions, advice, loadingAdvice])

  return (
    <div className="px-5 mb-8">
      <Card 
        onClick={() => router.push('/finances')}
        className="bg-[#005F56] border-none rounded-[24px] p-5 sm:p-6 flex items-center overflow-hidden relative min-h-[140px] sm:min-h-[160px] cursor-pointer group active:scale-[0.99] transition-all"
      >
        <div className="flex-1 relative z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 bg-white rounded flex items-center justify-center text-primary font-bold text-[9px] sm:text-[10px]">n</div>
            <span className="text-white text-[12px] sm:text-[13px] font-bold">nexTips</span>
            <ShieldCheck size={12} className="text-white opacity-80 sm:w-3.5 sm:h-3.5" />
          </div>
          <h3 className="text-white font-bold text-[18px] sm:text-[22px] mb-0.5 sm:mb-1">
            {loadingAdvice ? "Analyzing..." : "Elite Insights"}
          </h3>
          <div className="text-white/80 text-[11px] sm:text-[12px] leading-tight max-w-[160px] sm:max-w-[180px] line-clamp-3 italic font-medium">
            {loadingAdvice ? (
              <span className="flex items-center gap-2">
                <Loader2 size={10} className="animate-spin" /> Tailoring...
              </span>
            ) : (
              advice || "Discover smart ways to automate and grow your wealth."
            )}
          </div>
        </div>

        <div className="relative w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] flex-shrink-0 ml-1.5 sm:ml-2 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl transition-transform group-hover:scale-105">
          <Image 
            src="https://picsum.photos/seed/elite-fin/300/300"
            alt="Growth illustration"
            fill
            className="object-cover"
            data-ai-hint="luxury growth"
          />
        </div>

        <button className="ml-3 sm:ml-4 w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center text-primary flex-shrink-0 active:scale-90 transition-transform shadow-lg group-hover:translate-x-1">
          <ChevronRight size={20} className="sm:w-6 sm:h-6" />
        </button>
      </Card>
    </div>
  )
}
